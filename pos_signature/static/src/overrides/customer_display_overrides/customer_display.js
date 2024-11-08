import { CustomerDisplay } from "@point_of_sale/customer_display/customer_display";
import { patch } from "@web/core/utils/patch";
import { useRef } from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";

patch(CustomerDisplay.prototype, {
    setup() {
        super.setup(...arguments);

        this.signature = '';           // Static signature property
        this.salesTaxDisplay = '0.00'; // Static property for sales tax
        this.orderReady = false;       // Static flag for order readiness

        this.orm = useService("orm");
        this.my_canvas = useRef('my_canvas');
        window.signature = this.signature;
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

        this.drawing = false;

        // Ensure we call loadSalesTax only once we have a valid order ID
        this.checkOrderAndFetchTax();
    },

    async checkOrderAndFetchTax() {
        console.log("Checking if order is available...");
        const orderId = await this.getOrderId();  // Dynamically retrieve the order ID

        if (orderId) {
            console.log("Order ID retrieved:", orderId);
            this.loadSalesTax(orderId);  // Pass the order ID directly
        } else {
            console.warn("Order ID could not be retrieved.");
        }
    },

    async getOrderId() {
        // Replace this with the correct logic for dynamically getting the order ID
        // Assuming `this.order` is not immediately available
        const orderId = 16;  // Example static ID or dynamic logic here
        return orderId;
    },

    async loadSalesTax(orderId) {
        console.log("loadSalesTax: Fetching sales tax for order ID:", orderId);  // Log the order ID

        try {
            const response = await fetch('/pos/get_sales_tax', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "call",
                    params: { id: orderId },  // Use the specific order ID here
                    id: Math.floor(Math.random() * 1000)
                })
            });
            const orderData = await response.json();
            
            console.log("loadSalesTax: Received orderData:", orderData);  // Log the response

            if (orderData.result && orderData.result.sales_tax !== undefined) {
                this.salesTaxDisplay = orderData.result.sales_tax.toFixed(2);
                console.log("loadSalesTax: Updated salesTaxDisplay:", this.salesTaxDisplay);  // Log the updated sales tax
                this.renderSalesTax();
            } else {
                console.error("loadSalesTax: Sales tax not found in response:", orderData);
            }
        } catch (error) {
            console.error("loadSalesTax: Error fetching sales tax:", error);
        }
    },

    renderSalesTax() {
        const taxElement = document.querySelector("#salesTaxDisplay");
        if (taxElement) {
            taxElement.textContent = this.salesTaxDisplay;
        }
    },

    onClickClear() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.my_canvas.el.width, this.my_canvas.el.height);
        }
        this.signature_done = false;
    },

    async sendSignatureData(signature) {
        if (this.session.type === "local") {
            this.customerDisplayChannel.postMessage({ test: 'test', signature: signature });
        }
        if (this.session.type === "remote") {
            await rpc(
                `/pos-customer-display/${this.session.config_id}`,
                {
                    access_token: this.session.access_token,
                    signature: this.signature || false,
                }
            );
        }
    },

    get salesTaxDisplayValue() {
        return this.salesTaxDisplay || '0.00';  // Default to '0.00' if undefined
    },

    onSubmitSignature() {
        this.signature = this.my_canvas.el.toDataURL('image/png').replace('data:image/png;base64,', "");
    }
});