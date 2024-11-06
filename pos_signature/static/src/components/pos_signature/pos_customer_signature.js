/* Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>) */
/* See LICENSE file for full copyright and licensing details. */
/* License URL : <https://store.webkul.com/license.html/> */

import { PosOrder } from "@point_of_sale/app/models/pos_order";
import { _t } from "@web/core/l10n/translation";
import { patch } from "@web/core/utils/patch";
import { PaymentScreen } from "@point_of_sale/app/screens/payment_screen/payment_screen";
import { SignaturePopupWidget } from "@pos_signature/app/popups/signature_popup/signature_popup";
import { AlertDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { WaitingForSignature } from "@pos_signature/app/popups/waiting_for_signature_popup/waiting_for_signature_popup";
import { getOnNotified } from "@point_of_sale/utils";

patch(PosOrder.prototype, {
    setup(options) {
        this.signature = options.signature || "";
        this.waiting_for_signature = false;
        this.terms_conditions_link = false;
        this.clicking = false;
        this.mouse = { x: 0, y: 0 };
        this.canvas;
        this.ctx;
        super.setup(...arguments,options);
    },

    export_for_printing(baseUrl, headerData) {
        return{
            ...super.export_for_printing(...arguments),
            signature: this.signature,
        }
    },

    getCustomerDisplayData(){
        var res = {
            ...super.getCustomerDisplayData(),
            signature: this.signature||"",
            waiting_for_signature: this.waiting_for_signature || false,
            terms_conditions_link: this.config_id.terms_conditions_link || false,
        }
        return res
    }
})


patch(PaymentScreen.prototype, {

    setup(){
        super.setup(...arguments);        
        const currentOrder = this.pos.get_order();
        if (this.pos.config.customer_display_type === "local") {
            new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY").onmessage = (event) => {
                if(event.data.signature){
                    currentOrder.signature = event.data.signature;
                }
            };
        }
        
        if (this.pos.config.customer_display_type === "remote") {
            this.onNotified = getOnNotified(this.pos.bus, this.pos.config.access_token);
            this.onNotified("UPDATE_CUSTOMER_SIGNATURE",(signature)=>{
                currentOrder.signature = signature;
            })
        }
    },

    async add_signature(event) {
        const CurrentOrder = this.pos.get_order();
        
        if(this.pos.config.add_signature_from === 'cutomer_display' && ['local','remote'].includes(this.pos.config.customer_display_type)){
            if(this.currentOrder.signature=='')
                CurrentOrder.waiting_for_signature = true;
            this.dialog.add(WaitingForSignature, {})
        }
        else{
            this.dialog.add(SignaturePopupWidget, {})
        }
    },

    async validateOrder(isForceValidate) {
        if (this.pos.config.enable_pos_signature && this.pos.config.set_signature_mandatory) {
            if (this.pos.get_order().signature === '') {
                this.pos.get_order().signature = '';
                this.pos.get_order().canvas = '';
                this.pos.get_order().ctx = '';
                this.pos.get_order().mouse = { x: 0, y: 0 };
                this.env.services.dialog.add(AlertDialog, {
                    title: _t("Signature Required.."),
                    body: _t(
                        "Please Add Signature"
                    ),
                });
            } else {
                super.validateOrder(...arguments);
            }
        } else {
            super.validateOrder(...arguments);
        }
    }
});


