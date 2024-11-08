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
        // Directly initialize event listeners without `this.pos`
        this.initializeOrderListener();
    },

    initializeOrderListener() {
        // Poll until `get_total_tax` is available, then start broadcasting
        const orderListenerInterval = setInterval(() => {
            if (typeof this.get_total_tax === 'function') {
                this.updateLocalStorageWithTax();
                clearInterval(orderListenerInterval); // Stop interval once function is available
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
        console.log("Exporting for printing with baseUrl:", baseUrl, "and headerData:", headerData);
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
        console.log("Customer display data:", data);
        return data;
    }
});

// Patch PaymentScreen to initialize customer display channel and handle tax broadcasting without `this.pos`
patch(PaymentScreen.prototype, {
    setup() {
        super.setup(...arguments);
        console.log("Setting up PaymentScreen.");

        const customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

        // Listen for messages related to signature updates
        customerDisplayChannel.onmessage = (event) => {
            console.log("Received customer display message:", event.data);
            const order = this.env.pos.get_order();
            if (order && event.data.signature) {
                order.signature = event.data.signature;
            }
        };

        // Broadcast sales tax when `get_total_tax` is available on current order
        this.broadcastOrderUpdates();
    },

    broadcastOrderUpdates() {
        const order = this.env.pos.get_order();

        // Ensure function availability without directly using `this.pos`
        const taxListenerInterval = setInterval(() => {
            if (order && typeof order.get_total_tax === 'function') {
                const tax = order.get_total_tax();
                const customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

                console.log("Broadcasting sales tax for order:", tax);
                customerDisplayChannel.postMessage({
                    new_order_id: order.id,
                    sales_tax: tax,
                });

                clearInterval(taxListenerInterval); // Stop interval once broadcast is successful
            }
        }, 500);
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