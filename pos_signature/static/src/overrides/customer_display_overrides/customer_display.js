import { CustomerDisplay } from "@point_of_sale/customer_display/customer_display";
import { patch } from "@web/core/utils/patch";
import { useRef } from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";

patch(CustomerDisplay.prototype, {
    setup() {
        super.setup(...arguments);
        
        console.log("Setting up CustomerDisplay instance...");
        window.customerDisplayInstance = this;

        this.signature = '';
        this.salesTaxDisplay = '0.00';
        this.currentOrderId = null;
        this.orm = useService("orm");
        this.my_canvas = useRef('my_canvas');
        window.signature = this.signature;

        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");
        this.customerDisplayChannel.onmessage = (event) => {
            const { tax } = event.data; // Only take tax from the event
        
            if (tax !== undefined) {
                this.updateDisplayValues(tax); // Pass tax to the update function
            } else {
                console.warn("Broadcast message missing expected tax value:", event.data);
            }
        };

        console.log("Setting up page:change event listener...");
        window.addEventListener("page:change", (event) => {
            console.log("Page change detected:", event.detail.pageName);
            this.handlePageChange(event.detail.pageName);
        });
    },

    updateDisplayValues(tax) {
        console.log("Updating tax display. Tax:", tax);
    
        const taxElement = document.querySelector("#salesTaxDisplay");
    
        if (taxElement) {
            taxElement.textContent = tax.toFixed(2); // Update tax in the DOM
            console.log("Tax successfully updated in DOM:", tax.toFixed(2));
        } else {
            console.warn("Tax display element not found in DOM. Retrying...");
            setTimeout(() => this.updateDisplayValues(tax), 500); // Retry after delay
        }
    },

    // Handle page changes: load tax data if the order display is active
    async handlePageChange(pageName) {
        console.log("Handling page change to:", pageName);
        
        if (pageName === "order_display") {
            console.log("Order display page loaded. Loading tax data...");
            
            // Check if currentOrderId is available, and set a default for testing if it's missing
            if (!this.currentOrderId) {
                console.warn("No currentOrderId found. Setting a test ID for debugging.");
                this.currentOrderId = 16;  // Use a known order ID for testing
                
                // Optionally, fetch the ID dynamically if you have a way to retrieve the active order ID here
            }
    
            // Now attempt to load and render sales tax with the current or test Order ID
            if (this.currentOrderId) {
                await this.loadSalesTax(this.currentOrderId);
                this.renderSalesTax();
            }
        }
    },

    async handleOrderChange(newOrderId) {
        console.log("Handling order change. New Order ID:", newOrderId, "Current Order ID:", this.currentOrderId);
        
        // Forcefully update the tax, even if the order ID is the same
        this.currentOrderId = newOrderId;
        console.log("Updated currentOrderId to:", this.currentOrderId);
        await this.loadSalesTax(newOrderId);
        this.renderSalesTax();
    },

    async loadSalesTax(orderId) {
        console.log("Loading sales tax for order ID:", orderId);
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
            console.log("Received sales tax data from server:", orderData);

            if (orderData.result && orderData.result.sales_tax !== undefined) {
                this.salesTaxDisplay = orderData.result.sales_tax.toFixed(2);
                console.log("Updated salesTaxDisplay to:", this.salesTaxDisplay);
                this.renderSalesTax();
            } else {
                console.error("loadSalesTax: Sales tax not found in response:", orderData);
            }
        } catch (error) {
            console.error("loadSalesTax: Error fetching sales tax:", error);
        }
    },

    renderSalesTax() {
        console.log("Attempting to render sales tax. Current salesTaxDisplay value:", this.salesTaxDisplay);
        const taxElement = document.querySelector("#salesTaxDisplay");
        if (taxElement) {
            taxElement.textContent = this.salesTaxDisplay;
            console.log("Sales tax successfully rendered to DOM. Updated textContent:", taxElement.textContent);
        } else {
            console.warn("Tax display element not found in DOM. Retrying...");
            setTimeout(() => this.renderSalesTax(), 500);  // Retry after delay
        }
    },

    onClickClear() {
        console.log("Clearing signature on canvas.");
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.my_canvas.el.width, this.my_canvas.el.height);
        }
        this.signature_done = false;
    },

    async sendSignatureData(signature) {
        console.log("Sending signature data:", signature);
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
        console.log("Accessing salesTaxDisplayValue. Current value:", this.salesTaxDisplay);
        return this.salesTaxDisplay || '0.00';
    },

    onSubmitSignature() {
        console.log("Submitting signature.");
        this.signature = this.my_canvas.el.toDataURL('image/png').replace('data:image/png;base64,', "");
    }
});