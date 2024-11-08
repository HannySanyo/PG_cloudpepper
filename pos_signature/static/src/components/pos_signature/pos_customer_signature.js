import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { SignaturePopupWidget } from "@pos_signature/app/popups/signature_popup/signature_popup";
import { AlertDialog } from "@web/core/confirmatzion_dialog/confirmation_dialog";
import { WaitingForSignature } from "@pos_signature/app/popups/waiting_for_signature_popup/waiting_for_signature_popup";
import { getOnNotified } from "@point_of_sale/utils";

// Patch PosOrder to listen for order changes and broadcast updated data
patch(PosOrder.prototype, {

    setup() {
        super.setup(...arguments);

        // Initialize order event listener without using `this.pos`
        this.initializeOrderListener();
    },

    initializeOrderListener() {
        const orderListenerInterval = setInterval(() => {
            if (typeof this.get_total_tax === 'function') {
                this.updateLocalStorageWithTax();
                clearInterval(orderListenerInterval); // Stop interval once ready
            } else {
                console.warn("Waiting for `get_total_tax` to be available on PosOrder.");
            }
        }, 500);
    },

    updateLocalStorageWithTax() {
        const tax = this.get_total_tax() || 0;
        const data = { tax, timestamp: new Date().toISOString() };

        console.log("Updating localStorage with tax data:", data);
        localStorage.setItem('customerDisplayTaxData', JSON.stringify(data));
    },

    add_line(line) {
        this._super(line);
        this.updateLocalStorageWithTax();
    },

    remove_line(line) {
        this._super(line);
        this.updateLocalStorageWithTax();
    },

    export_for_printing(baseUrl, headerData) {
        console.log("Exporting for printing with baseUrl:", baseUrl, "and headerData:", headerData); // Debug print export
        return {
            ...super.export_for_printing(...arguments),
            signature: this.signature,
        };
    },

    getCustomerDisplayData() {
        const data = {
            ...super.getCustomerDisplayData(),
            signature: this.signature || "",
            waiting_for_signature: this.waiting_for_signature || false,
            terms_conditions_link: this.config_id.terms_conditions_link || false,
        };
        console.log("Customer display data:", data); // Log display data
        return data;
    }
});

// Patch PaymentScreen to initialize broadcasting on setup and broadcast changes in sales tax
patch(PaymentScreen.prototype, {
    setup() {
        super.setup(...arguments);
        console.log("Setting up PaymentScreen."); // Log setup call

        if (this.pos) {
            const currentOrder = this.pos.get_order();
            console.log("Current order at PaymentScreen setup:", currentOrder); // Log initial order

            if (this.pos.config.customer_display_type === "local") {
                const customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

                customerDisplayChannel.onmessage = (event) => {
                    console.log("Received customer display message:", event.data); // Log received message
                    if (event.data.signature) {
                        currentOrder.signature = event.data.signature;
                    }
                };

                this.pos.on('change:selectedOrder', (newOrder) => {
                    if (newOrder && typeof newOrder.get_total_tax === 'function') {
                        console.log("Broadcasting sales tax for new order:", newOrder.get_total_tax());
                        customerDisplayChannel.postMessage({
                            new_order_id: newOrder.id,
                            sales_tax: newOrder.get_total_tax()
                        });
                    }
                });
            }

            if (this.pos.config.customer_display_type === "remote") {
                this.onNotified = getOnNotified(this.pos.bus, this.pos.config.access_token);
                this.onNotified("UPDATE_CUSTOMER_SIGNATURE", (signature) => {
                    console.log("Updating signature remotely:", signature);
                    currentOrder.signature = signature;
                });
            }
        } else {
            console.warn("this.pos is undefined in PaymentScreen setup.");
        }
    },

    async add_signature(event) {
        const currentOrder = this.pos?.get_order();
        console.log("Adding signature, current order:", currentOrder); // Debug signature addition

        if (this.pos?.config.add_signature_from === 'customer_display' && 
            ['local', 'remote'].includes(this.pos.config.customer_display_type)) {
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
        if (this.pos?.config.enable_pos_signature && this.pos.config.set_signature_mandatory) {
            if (this.pos?.get_order().signature === '') {
                console.warn("Signature required but missing."); // Warn if signature is missing
                this.env.services.dialog.add(AlertDialog, {
                    title: _t("Signature Required"),
                    body: _t("Please Add Signature"),
                });
            } else {
                console.log("Validating order with signature."); // Confirm validation
                super.validateOrder(...arguments);
            }
        } else {
            super.validateOrder(...arguments);
        }
    }
});