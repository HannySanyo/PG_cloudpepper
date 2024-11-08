import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { SignaturePopupWidget } from "@pos_signature/app/popups/signature_popup/signature_popup";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { WaitingForSignature } from "@pos_signature/app/popups/waiting_for_signature_popup/waiting_for_signature_popup";

// Patch PosOrder to handle tax data updates in local storage
patch(PosOrder.prototype, {
    setup() {
        super.setup(...arguments);
        console.log("Setting up PosOrder for conditional tax updates.");

        // Initialize previous tax value to detect changes
        this.previousTaxValue = null;

        // Initialize BroadcastChannel for customer display updates
        try {
            this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");
            console.log("BroadcastChannel initialized successfully for customer display.");
        } catch (error) {
            console.error("BroadcastChannel initialization failed:", error);
        }

        // Trigger initial update on setup if necessary
        this.sendInitialDisplayUpdate();
    },

    // Function to send initial order data to customer display
    sendInitialDisplayUpdate() {
        console.log("Sending initial display update for order data.");
        if (this.customerDisplayChannel) {
            this.customerDisplayChannel.postMessage({
                page: "order_display",
                sales_tax: this.previousTaxValue || 0  // Provide initial tax value
            });
        } else {
            console.warn("Customer display channel is unavailable for initial display update.");
        }
    },

    // Update localStorage only when there is a tax change
    updateLocalStorageWithTax() {
        const currentTax = this.get_total_tax ? this.get_total_tax() : 0;

        if (currentTax !== this.previousTaxValue) {
            const taxData = {
                sales_tax: currentTax,
                timestamp: new Date().toISOString(),
            };
            localStorage.setItem('customerDisplayTaxData', JSON.stringify(taxData));
            console.log("Updated localStorage with tax data:", taxData);

            // Send tax update to customer display via BroadcastChannel
            if (this.customerDisplayChannel) {
                this.customerDisplayChannel.postMessage(taxData);
                console.log("Tax data sent to customer display:", taxData);
            } else {
                console.warn("Customer display channel is unavailable.");
            }

            // Update previousTaxValue to reflect the latest stored value
            this.previousTaxValue = currentTax;
        }
    },

    // Method to get and send updated customer display data, called when necessary
    getCustomerDisplayData() {
        const data = {}; // Replace with actual order data as needed

        // Get current tax amount
        const currentTax = this.get_total_tax ? this.get_total_tax() : 0;

        // Check if there's a difference from the previous tax and update localStorage if needed
        if (currentTax !== this.previousTaxValue) {
            const taxData = {
                sales_tax: currentTax,
                timestamp: new Date().toISOString(),
            };
            localStorage.setItem('customerDisplayTaxData', JSON.stringify(taxData));
            console.log("Updated localStorage with tax data:", taxData);

            // Use BroadcastChannel to notify customer display of the tax update
            if (this.customerDisplayChannel) {
                this.customerDisplayChannel.postMessage(taxData);
                console.log("Tax data broadcasted to customer display:", taxData);
            } else {
                console.warn("Customer display channel is unavailable.");
            }

            // Update previousTaxValue to reflect the stored value
            this.previousTaxValue = currentTax;
        }

        return data;
    }
});

// Patch PaymentScreen to initialize customer display channel and handle tax broadcasting
patch(PaymentScreen.prototype, {
    setup() {
        super.setup(...arguments);
        console.log("Setting up PaymentScreen.");

        // Initialize BroadcastChannel for real-time updates
        try {
            this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");
            console.log("PaymentScreen BroadcastChannel initialized successfully.");
        } catch (error) {
            console.error("BroadcastChannel initialization failed:", error);
        }

        // Listen for signature updates from the customer display
        if (this.customerDisplayChannel) {
            this.customerDisplayChannel.onmessage = (event) => {
                console.log("Received customer display message:", event.data);
                const order = this.env.pos?.get_order();
                if (order && event.data.signature) {
                    order.signature = event.data.signature;
                    console.log("Order signature updated from customer display.");
                }
            };
        }
    },

    async add_signature(event) {
        const currentOrder = this.env.pos?.get_order();
        console.log("Adding signature, current order:", currentOrder);

        if (this.env.pos?.config.add_signature_from === 'customer_display' && 
            ['local', 'remote'].includes(this.env.pos.config.customer_display_type)) {
            if (currentOrder?.signature === '') {
                currentOrder.waiting_for_signature = true;
                console.log("Waiting for signature from customer display.");
            }
            this.dialog.add(WaitingForSignature, {});
        } else {
            this.dialog.add(SignaturePopupWidget, {});
        }
    },

    async validateOrder(isForceValidate) {
        if (this.env.pos?.config.enable_pos_signature && this.env.pos.config.set_signature_mandatory) {
            if (this.env.pos?.get_order().signature === '') {
                console.warn("Signature required but missing.");
                this.env.services.dialog.add(AlertDialog, {
                    title: _t("Signature Required"),
                    body: _t("Please Add Signature"),
                });
            } else {
                console.log("Validating order with signature.");
                super.validateOrder(...arguments);
            }
        } else {
            super.validateOrder(...arguments);
        }
    }
});