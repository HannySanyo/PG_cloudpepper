import { CustomerDisplay } from "@point_of_sale/customer_display/customer_display";
import { patch } from "@web/core/utils/patch";
import { useRef } from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";

patch(CustomerDisplay.prototype, {
    setup() {
        super.setup(...arguments);
        
        // Attach instance to window for debugging
        window.customerDisplayInstance = this; // Add this line

        this.signature = '';
        this.salesTaxDisplay = '0.00';
        this.currentOrderId = null;
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");
    
        // Listener to handle order changes
        this.customerDisplayChannel.onmessage = (event) => {
            if (event.data && event.data.new_order_id) {
                this.handleOrderChange(event.data.new_order_id);
            }
        };
    
        // Render sales tax only once the DOM is fully loaded
        document.addEventListener("DOMContentLoaded", () => {
            this.renderSalesTax();
        });
    
        this.drawing = false;
        this.checkOrderAndFetchTax();
    },

    // Function to handle order changes
    async handleOrderChange(newOrderId) {
        if (this.currentOrderId !== newOrderId) {
            this.currentOrderId = newOrderId;
            console.log("New Order ID received:", newOrderId);
            await this.loadSalesTax(newOrderId);  // Fetch and load tax for the new order
        }
    },

    async checkOrderAndFetchTax() {
        const orderId = await this.getOrderId();  // Dynamically retrieve the order ID

        if (orderId) {
            console.log("Order ID retrieved:", orderId);
            this.currentOrderId = orderId;
            await this.loadSalesTax(orderId);  // Pass the order ID directly
        } else {
            console.warn("Order ID could not be retrieved.");
        }
    },

    async getOrderId() {
        // Replace this with the correct logic for dynamically getting the order ID
        const orderId = 16;  // Example static ID or dynamic logic here
        return orderId;
    },

    async loadSalesTax(orderId) {
        console.log("loadSalesTax: Fetching sales tax for order ID:", orderId);
    
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
                    params: { id: orderId },
                    id: Math.floor(Math.random() * 1000)
                })
            });
            const orderData = await response.json();
            
            console.log("loadSalesTax: Received orderData:", orderData);
    
            if (orderData.result && orderData.result.sales_tax !== undefined) {
                this.salesTaxDisplay = orderData.result.sales_tax.toFixed(2);
                console.log("loadSalesTax: Updated salesTaxDisplay:", this.salesTaxDisplay);
                this.renderSalesTax();  // Call render after setting the tax
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
            console.log("Tax display updated:", this.salesTaxDisplay);
        } else {
            console.warn("Tax display element not found in DOM. Retrying...");
            setTimeout(() => this.renderSalesTax(), 100); // Retry after 100ms
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
        return this.salesTaxDisplay || '0.00';
    },

    onSubmitSignature() {
        this.signature = this.my_canvas.el.toDataURL('image/png').replace('data:image/png;base64,', "");
    }
});