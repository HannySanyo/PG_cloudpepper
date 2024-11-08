import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { SignaturePopupWidget } from "@pos_signature/app/popups/signature_popup/signature_popup";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { WaitingForSignature } from "@pos_signature/app/popups/waiting_for_signature_popup/waiting_for_signature_popup";
import { getOnNotified } from "@point_of_sale/utils";

// Patch PosOrder to listen for order changes and broadcast updated data
patch(PosOrder.prototype, {
    setup(options) {
        this.signature = options.signature || "";
        this.waiting_for_signature = false;
        this.terms_conditions_link = false;
        super.setup(...arguments, options);

        // Broadcast channel for updating customer display
        const customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

        // Broadcast order data whenever there's a change in the active order
        this.pos.on('change:selectedOrder', (newOrder) => {
            if (newOrder) {
                customerDisplayChannel.postMessage({
                    new_order_id: newOrder.id,
                    sales_tax: newOrder.get_total_tax() // Assuming a method exists for total tax
                });
            }
        });
    },

    // Method to export additional data for printing
    export_for_printing(baseUrl, headerData) {
        return {
            ...super.export_for_printing(...arguments),
            signature: this.signature,
        }
    },

    getCustomerDisplayData() {
        return {
            ...super.getCustomerDisplayData(),
            signature: this.signature || "",
            waiting_for_signature: this.waiting_for_signature || false,
            terms_conditions_link: this.config_id.terms_conditions_link || false,
        };
    }
});

// Patch PaymentScreen to initialize broadcasting on setup and broadcast changes in sales tax
patch(PaymentScreen.prototype, {

    setup() {
        super.setup(...arguments);        
        const currentOrder = this.pos.get_order();
        
        if (this.pos.config.customer_display_type === "local") {
            const customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");
            
            // Listen for any local customer display updates, especially signature updates
            customerDisplayChannel.onmessage = (event) => {
                if (event.data.signature) {
                    currentOrder.signature = event.data.signature;
                }
            };

            // Broadcast sales tax whenever it updates
            this.pos.on('change:selectedOrder', (newOrder) => {
                if (newOrder) {
                    customerDisplayChannel.postMessage({
                        new_order_id: newOrder.id,
                        sales_tax: newOrder.get_total_tax() // Assuming method to get total tax
                    });
                }
            });
        }
        
        // For remote, use the bus for customer signature update notification
        if (this.pos.config.customer_display_type === "remote") {
            this.onNotified = getOnNotified(this.pos.bus, this.pos.config.access_token);
            this.onNotified("UPDATE_CUSTOMER_SIGNATURE", (signature) => {
                currentOrder.signature = signature;
            });
        }
    },

    // Show the signature popup if required
    async add_signature(event) {
        const currentOrder = this.pos.get_order();
        
        if (this.pos.config.add_signature_from === 'customer_display' && ['local','remote'].includes(this.pos.config.customer_display_type)) {
            if (currentOrder.signature === '') {
                currentOrder.waiting_for_signature = true;
            }
            this.dialog.add(WaitingForSignature, {});
        } else {
            this.dialog.add(SignaturePopupWidget, {});
        }
    },

    // Validate the order, enforcing signature if required
    async validateOrder(isForceValidate) {
        if (this.pos.config.enable_pos_signature && this.pos.config.set_signature_mandatory) {
            if (this.pos.get_order().signature === '') {
                this.env.services.dialog.add(AlertDialog, {
                    title: _t("Signature Required"),
                    body: _t("Please Add Signature"),
                });
            } else {
                super.validateOrder(...arguments);
            }
        } else {
            super.validateOrder(...arguments);
        }
    }
});