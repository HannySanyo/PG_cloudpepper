import { CustomerDisplay } from "@point_of_sale/customer_display/customer_display";
import { patch } from "@web/core/utils/patch";
import { useRef } from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";

patch(CustomerDisplay.prototype, {
    setup() {
        super.setup(...arguments);

        this.salesTaxDisplay = '0.00';

        // Initialize BroadcastChannel for receiving updates
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");
        this.customerDisplayChannel.onmessage = (event) => {
            console.log("Customer display received message:", event.data); // Log received message
            const taxData = event.data;

            // Check if the data includes sales tax or page update instructions
            if (taxData && taxData.sales_tax !== undefined) {
                this.salesTaxValue = taxData.sales_tax;
                this.checkAndUpdateDisplay(); // Update tax display if applicable
            } else if (taxData.page === "order_display") {
                console.log("Received signal to display order details.");
                this.handleOrderDisplayTransition(); // Handle natural order display transition
            }
        };
    },

    // Function to handle the page transition for order display
    handleOrderDisplayTransition() {
        console.log("Order display transition acknowledged by customer display.");

        // Check if elements are ready for updates
        this.checkAndUpdateDisplay();
    },

    // Check and update the display if elements are available
    checkAndUpdateDisplay() {
        // Log the current page state and element status to aid in debugging
        console.log("checkAndUpdateDisplay: Verifying if order display page is loaded.");

        const taxElement = document.querySelector("#salesTaxDisplay");
        if (taxElement) {
            taxElement.textContent = this.salesTaxValue.toFixed(2);
            console.log("Updated Sales Tax on Customer Display:", this.salesTaxValue);
        } else {
            console.warn("Tax display element not found in DOM. Waiting for page transition...");
        }
    },

    updateDisplayValues(tax) {
        const taxElement = document.querySelector("#salesTaxDisplay");
        if (taxElement) {
            taxElement.textContent = tax.toFixed(2);
            console.log("Updated Sales Tax on Customer Display:", tax);
        } else {
            console.warn("Tax display element not found in DOM. Retrying...");
        }
    },

    // Method to handle page change events, if naturally triggered by the POS
    async handlePageChange(pageName) {
        console.log("Handling page change to:", pageName);
        
        if (pageName === "order_display") {
            console.log("Order display page loaded. Preparing to load tax data...");
            
            if (!this.currentOrderId) {
                console.warn("No currentOrderId found. Setting a test ID for debugging.");
                this.currentOrderId = 16; // Use a known order ID for testing
            }

            if (this.currentOrderId) {
                await this.loadSalesTax(this.currentOrderId);
                this.renderSalesTax();
            }
        }
    },

    async handleOrderChange(newOrderId) {
        console.log("Handling order change. New Order ID:", newOrderId, "Current Order ID:", this.currentOrderId);
        
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
            console.warn("Tax display element not found in DOM. Waiting for order display page...");
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