import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { SignaturePopupWidget } from "@pos_signature/app/popups/signature_popup/signature_popup";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { WaitingForSignature } from "@pos_signature/app/popups/waiting_for_signature_popup/waiting_for_signature_popup";
import { getOnNotified } from "@point_of_sale/utils";

// Patch PosOrder to handle tax data updates in local storage
patch(PosOrder.prototype, {
    setup() {
        super.setup(...arguments);
        console.log("Setting up PosOrder for conditional tax updates.");

        // Initialize the previous tax value to detect changes
        this.previousTaxValue = null;

        // Initialize BroadcastChannel for customer display updates
        if (!this.customerDisplayChannel) {
            this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");
        }
    },

    // Method to update localStorage when there's a tax change
    updateLocalStorageWithTax() {
        const currentTax = this.get_total_tax ? this.get_total_tax() : 0;

        // Update localStorage and BroadcastChannel only on tax change
        if (currentTax !== this.previousTaxValue) {
            const taxData = {
                sales_tax: currentTax,
                timestamp: new Date().toISOString(),
            };
            localStorage.setItem('customerDisplayTaxData', JSON.stringify(taxData));
            console.log("Updated localStorage with tax data:", taxData);

            // Send tax update to customer display via BroadcastChannel
            this.customerDisplayChannel.postMessage(taxData);

            // Update previousTaxValue to reflect the latest stored value
            this.previousTaxValue = currentTax;
        }
    },

    // Call getCustomerDisplayData to update tax data
    getCustomerDisplayData() {
        const data = this._super();

        // Get current tax amount
        const currentTax = this.get_total_tax ? this.get_total_tax() : 0;

        // Check if tax changed, then update localStorage and broadcast
        if (currentTax !== this.previousTaxValue) {
            const taxData = {
                sales_tax: currentTax,
                timestamp: new Date().toISOString(),
            };
            localStorage.setItem('customerDisplayTaxData', JSON.stringify(taxData));
            console.log("Updated localStorage with tax data:", taxData);

            // BroadcastChannel to notify customer display of the tax update
            if (!this.customerDisplayChannel) {
                this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");
            }
            this.customerDisplayChannel.postMessage(taxData);

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
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

        // Listen for signature updates from the customer display
        this.customerDisplayChannel.onmessage = (event) => {
            console.log("Received customer display message:", event.data);
            const order = this.env.pos.get_order();
            if (order && event.data.signature) {
                order.signature = event.data.signature;
            }
        };
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