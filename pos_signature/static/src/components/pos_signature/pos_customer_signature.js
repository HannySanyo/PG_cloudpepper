import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { SignaturePopupWidget } from "@pos_signature/app/popups/signature_popup/signature_popup";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { WaitingForSignature } from "@pos_signature/app/popups/waiting_for_signature_popup/waiting_for_signature_popup";
import { getOnNotified } from "@point_of_sale/utils";

// Patch for PosOrder to manage sales tax updates and customer display data
patch(PosOrder.prototype, {
    setup(options) {
        this.signature = options.signature || "";
        this.waiting_for_signature = false;
        this.terms_conditions_link = false;
        this.clicking = false;
        this.mouse = { x: 0, y: 0 };
        this.canvas;
        this.ctx;
        super.setup(...arguments, options);
        console.log("PosOrder setup complete. Initial order setup:", this);

        // Initialize previousTaxValue to track changes
        this.previousTaxValue = null;

        // Initialize BroadcastChannel for customer display updates
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");
    },

    export_for_printing(baseUrl, headerData) {
        const exportData = {
            ...super.export_for_printing(...arguments),
            signature: this.signature,
        };
        console.log("Data exported for printing:", exportData);
        return exportData;
    },

    getCustomerDisplayData() {
        console.log("getCustomerDisplayData called. Checking for tax update...");
        // Trigger the tax update check whenever display data is fetched
        this.updateLocalStorageWithTax();

        const res = {
            ...super.getCustomerDisplayData(),
            signature: this.signature || "",
            waiting_for_signature: this.waiting_for_signature || false,
            terms_conditions_link: this.config_id?.terms_conditions_link || false,
        };
        console.log("Customer Display Data prepared:", res);  // Log data sent to the customer display
        return res;
    },

    updateLocalStorageWithTax() {
        const currentTax = this.get_total_tax ? this.get_total_tax() : 0;
        console.log("updateLocalStorageWithTax called. Current tax calculated:", currentTax);

        // Only update localStorage if there's an actual change in tax
        if (currentTax !== this.previousTaxValue) {
            const taxData = {
                sales_tax: currentTax,
                timestamp: new Date().toISOString(),
            };

            // Store sales tax in localStorage
            localStorage.setItem('customerDisplayTaxData', JSON.stringify(taxData));
            console.log("Updated localStorage with sales tax data:", taxData);

            // Send updated tax data to customer display via BroadcastChannel
            if (this.customerDisplayChannel) {
                this.customerDisplayChannel.postMessage(taxData);
                console.log("Broadcasted tax data to customer display:", taxData);
            } else {
                console.warn("Customer display channel is unavailable for tax update.");
            }

            // Update previousTaxValue to reflect the latest stored value
            this.previousTaxValue = currentTax;
        } else {
            console.log("No change in tax. Skipping localStorage update.");
        }
    }
});

// Patch for PaymentScreen to manage display data and order validation
patch(PaymentScreen.prototype, {
    setup() {
        super.setup(...arguments);
        const currentOrder = this.pos.get_order();
        console.log("PaymentScreen setup complete. Current order:", currentOrder);

        // Initialize BroadcastChannel for local display
        if (this.pos.config.customer_display_type === "local") {
            const channel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");
            channel.onmessage = (event) => {
                console.log("Received message on local display:", event.data);
                if (event.data.page === "order_display") {
                    console.log("Transition to order display page received.");
                }
            };
        }

        // Setup notification handler for remote display type
        if (this.pos.config.customer_display_type === "remote") {
            this.onNotified = getOnNotified(this.pos.bus, this.pos.config.access_token);
            this.onNotified("UPDATE_CUSTOMER_SIGNATURE", (data) => {
                console.log("Notification received for remote display update:", data);
            });
        }
    },

    async add_signature(event) {
        const currentOrder = this.pos.get_order();
        console.log("Signature addition triggered. Current order state:", currentOrder);

        // Original logic untouched
        if (this.pos.config.add_signature_from === 'customer_display' && ['local', 'remote'].includes(this.pos.config.customer_display_type)) {
            if (currentOrder.signature === '') {
                currentOrder.waiting_for_signature = true;
                console.log("Waiting for signature from customer display.");
            }
            this.dialog.add(WaitingForSignature, {});
        } else {
            this.dialog.add(SignaturePopupWidget, {});
        }
    },

    async validateOrder(isForceValidate) {
        const currentOrder = this.pos.get_order();
        console.log("Order validation triggered. Current order signature status:", currentOrder.signature);

        // Signature validation logic unchanged
        if (this.pos.config.enable_pos_signature && this.pos.config.set_signature_mandatory) {
            if (currentOrder.signature === '') {
                console.warn("Signature required but missing.");
                this.env.services.dialog.add(AlertDialog, {
                    title: _t("Signature Required"),
                    body: _t("Please Add Signature"),
                });
            } else {
                console.log("Signature present. Proceeding with validation.");
                super.validateOrder(...arguments);
            }
        } else {
            super.validateOrder(...arguments);
        }
    }
});