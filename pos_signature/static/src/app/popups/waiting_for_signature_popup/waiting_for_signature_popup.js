
/* Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>) */
/* See LICENSE file for full copyright and licensing details. */
/* License URL : <https://store.webkul.com/license.html/> */
import { Component } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { onMounted, useState } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";

export class WaitingForSignature extends Component {
    static template = "pos_signature.WaitingForSignature";
    static components = { Dialog };

    async setup() {
        super.setup();
        this.pos = usePos();
        this.currentOrder = this.pos.get_order();
        this.state = useState({
            'is_signed': false,
            'title': 'Waiting For Customer Signature ...'
        })
        onMounted(this.onMounted)
    }

    waitForSignature(){
        var self = this;
        self.state.title = 'Waiting For Customer Signature ...'
        return new Promise((resolve)=>{
            const checkSignature = ()=>{
                if(!self.currentOrder.signature==''){
                    resolve(true)
                }
                else{
                    setTimeout(checkSignature,100)
                }
            };
            checkSignature();
        })
    }

    async onMounted() {
        this.state.title = 'Waiting For Customer Signature ...'
        if (this.currentOrder.signature) {
            this.state.title = 'Customer Signature'

            this.state.is_signed = true;
            let data = "data:image/png;base64," + this.currentOrder.signature;
            let newImg = new Image();
            newImg.src = data;
            newImg.style.width = '100%';
            newImg.style.height = '200px';
            
            await new Promise((resolve) => {
                if(newImg){
                    newImg.onload = resolve;
                }
            })   
            setTimeout(()=>{
                let $sign_box = $('.signature-box');
                $sign_box.append(newImg);
            },120)
            
            return;
        }
        await this.waitForSignature().then(value=>{
            this.props.close();
            this.currentOrder.waiting_for_signature = false;
        })
    }

    async retake(){
        this.state.is_signed = false;
        
        this.currentOrder.waiting_for_signature = true;
        this.currentOrder.signature = '';
        await this.waitForSignature().then(value=>{
            this.props.close(); 
            this.currentOrder.waiting_for_signature = false;

        })
    }

    cancel(){
        this.currentOrder.waiting_for_signature = false;
        this.props.close();
        this.currentOrder.waiting_for_signature = false;
    }
    delete_sign(){
        this.currentOrder.signature='';
        this.currentOrder.is_signature_draw=false;
        this.props.close();
    }
}