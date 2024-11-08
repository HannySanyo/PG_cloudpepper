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
        console.log("Setting up PosOrder with tax updates.");

        // Defer the setup until the POS order environment is fully ready
        this.env.bus.on('pos_ready', this, this.initializeTaxUpdate);
    },

    initializeTaxUpdate() {
        console.log("POS environment confirmed ready; initializing tax updates.");

        // Attach event listeners to update tax when order changes occur
        this.env.pos.on('change:selectedOrder', this.updateLocalStorageWithTax.bind(this));
        this.updateLocalStorageWithTax(); // Initial call to set the tax on startup
    },

    updateLocalStorageWithTax() {
        const order = this.env.pos?.get_order();
        if (order && typeof order.get_total_tax === 'function') {
            const tax = order.get_total_tax() || 0;
            const data = { sales_tax: tax, timestamp: new Date().toISOString() };

            console.log("Updating localStorage with tax data:", data);
            localStorage.setItem('customerDisplayTaxData', JSON.stringify(data));
        } else {
            console.warn("Order or get_total_tax not available for updating tax data.");
        }
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

        // Initialize BroadcastChannel only once
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");

        // Listen for messages related to signature updates
        this.customerDisplayChannel.onmessage = (event) => {
            console.log("Received customer display message:", event.data);
            const order = this.env.pos.get_order();
            if (order && event.data.signature) {
                order.signature = event.data.signature;
            }
        };

        // Trigger broadcast when order tax data updates
        this.env.pos.on('change:selectedOrder', this.broadcastOrderUpdates.bind(this));
    },

    broadcastOrderUpdates() {
        const order = this.env.pos.get_order();
        if (order && typeof order.get_total_tax === 'function') {
            const tax = order.get_total_tax();

            console.log("Broadcasting sales tax for order:", tax);
            this.customerDisplayChannel.postMessage({
                new_order_id: order.id,
                sales_tax: tax,
            });
        } else {
            console.warn("Order or `get_total_tax` not available for broadcasting.");
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