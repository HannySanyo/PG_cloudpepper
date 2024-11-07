import { CustomerDisplay } from "@point_of_sale/customer_display/customer_display";
import { patch } from "@web/core/utils/patch";
import { useRef } from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";

patch(CustomerDisplay.prototype, {
    setup() {
        super.setup(...arguments);

        // Directly define properties without useState or reactivity triggers
        this.signature = '';           // Static signature property
        this.salesTaxDisplay = '0.00'; // Static property for sales tax
        this.orderReady = false;       // Static flag for order readiness

        this.orm = useService("orm");
        this.my_canvas = useRef('my_canvas');
        window.signature = this.signature;
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

        this.drawing = false;

        // Check if the order is available and load sales tax once
        if (this.order && this.order.id) {
            this.orderReady = true;
            this.loadSalesTax();
        }
    },

    async loadSalesTax() {
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
                    params: { id: this.order.id },
                    id: Math.floor(Math.random() * 1000)
                })
            });
            const orderData = await response.json();
    
            // Update sales tax display directly
            if (orderData.result && orderData.result.sales_tax !== undefined) {
                this.salesTaxDisplay = orderData.result.sales_tax.toFixed(2);
                this.renderSalesTax(); // Render sales tax directly without reactivity
            } else {
                console.error("Sales tax not found in response:", orderData);
            }
        } catch (error) {
            console.error("Error fetching sales tax:", error);
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

    // Signature and other methods remain unchanged, no effects involved
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