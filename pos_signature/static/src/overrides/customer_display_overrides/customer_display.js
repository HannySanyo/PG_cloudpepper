import { CustomerDisplay } from "@point_of_sale/customer_display/customer_display";
import { patch } from "@web/core/utils/patch";
import { useRef } from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";

patch(CustomerDisplay.prototype, {
    setup() {
        super.setup(...arguments);
        
        // Debugging: Attach instance to window
        window.customerDisplayInstance = this;

        this.signature = '';
        this.salesTaxDisplay = '0.00';
        this.currentOrderId = null;
        this.orm = useService("orm");
        this.my_canvas = useRef('my_canvas');
        window.signature = this.signature;

        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");
        
        // Listen for navigation to the order display screen
        this.customerDisplayChannel.onmessage = (event) => {
            if (event.data && event.data.new_order_id) {
                this.handleOrderChange(event.data.new_order_id);
            }
        };

        // Listen for page changes to trigger tax update on order screen load
        this.env.bus.on("page:change", this, this.handlePageChange);  // Custom event listener
    },

    // Handle page changes: load tax data if the order display is active
    async handlePageChange(pageName) {
        if (pageName === "order_display") {  // Make sure this matches your order display page ID/name
            console.log("Order display page loaded. Loading tax data...");
            if (this.currentOrderId) {
                await this.loadSalesTax(this.currentOrderId);
                this.renderSalesTax();
            }
        }
    },

    async handleOrderChange(newOrderId) {
        if (this.currentOrderId !== newOrderId) {
            this.currentOrderId = newOrderId;
            await this.loadSalesTax(newOrderId);
            this.renderSalesTax();
        }
    },

    async loadSalesTax(orderId) {
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

            if (orderData.result && orderData.result.sales_tax !== undefined) {
                this.salesTaxDisplay = orderData.result.sales_tax.toFixed(2);
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
        } else {
            console.warn("Tax display element not found in DOM. Retrying...");
            setTimeout(() => this.renderSalesTax(), 500);  // Retry after delay
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