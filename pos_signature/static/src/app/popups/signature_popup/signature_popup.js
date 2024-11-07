/* Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>) */
/* See LICENSE file for full copyright and licensing details. */
/* License URL : <https://store.webkul.com/license.html/> */

import { onMounted } from "@odoo/owl";
import { usePos } from "@point_of_sale/app/store/pos_hook";
import { Component } from "@odoo/owl";
import { Dialog } from "@web/core/dialog/dialog";
const { useRef } = owl;

export class SignaturePopupWidget extends Component {
    static template = "pos_signature.SignaturePopupWidget";
    static components = { Dialog };
    setup() {
        super.setup();
        this.pos = usePos();
        onMounted(this.onMounted);
        this.wkcanvas = useRef('wkcanvas');
    }

    onMounted() {
        let canvas = this.wkcanvas.el;
        canvas.addEventListener('mousemove', (ev) => {
            this.signatureMouseMove(ev)
        });
        canvas.addEventListener('touchmove', (ev) => this.signatureMouseMove(ev));
        canvas.addEventListener('mouseup', (ev) => this.signatureMouseUp(ev));
        canvas.addEventListener('touchend', (ev) => this.signatureMouseUp(ev));
        canvas.addEventListener('mouseout', (ev) => this.signatureMouseUp(ev));
        canvas.addEventListener('mousedown', (ev) => this.signatureMouseDown(ev));
        canvas.addEventListener('touchstart', (ev) => this.signatureMouseDown(ev));
        if (this.pos.get_order().signature_canvas) {
            let ctx = canvas.getContext('2d');
            let data = "data:image/png;base64," + this.pos.get_order().signature;
            let newImg = new Image();
            newImg.src = data;
            newImg.onload = () => {
                ctx.drawImage(newImg, 0, 0)
            }
        }
    }

    signatureMouseMove(event) {
        const canvas = this.wkcanvas.el;
        const current_order = this.pos.get_order();
        current_order.canvas = canvas;
        current_order.ctx = canvas.getContext('2d');
        var offset_left = $("#paint").offset().left;
        var offset_top = $("#paint").offset().top;
        const pageX = event.pageX || event.originalEvent.touches[0].pageX;
        const pageY = event.pageY || event.originalEvent.touches[0].pageY;
        current_order.mouse.x = Math.round(pageX - offset_left);
        current_order.mouse.y = Math.round(pageY - offset_top);
        const ctx = current_order.ctx;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'grey';
        if (current_order.clicking) {
            current_order.is_signature_draw = true;
            ctx.lineTo(current_order.mouse.x, current_order.mouse.y);
            ctx.stroke();
        }
    }

    signatureMouseUp(event) {
        this.pos.get_order().clicking = false;
    }

    signatureMouseDown(event) {
        this.pos.get_order().ctx.beginPath();
        this.pos.get_order().clicking = true;
    }

    click_confirm(event) {
        var current_order = this.pos.get_order();
        if (current_order && current_order.is_signature_draw) {
            current_order.signature = current_order.canvas.toDataURL("image/png").replace('data:image/png;base64,', "");
            current_order.signature_canvas = current_order.canvas;
        }
        this.props.close();
    }

    cancel() {
        var current_order = this.pos.get_order();
        if (current_order.signature == '')
            current_order.is_signature_draw = false;
        this.props.close();
    }

    clear_signature(event) {
        var current_order = this.pos.get_order();
        current_order.ctx.clearRect(0, 0, current_order.canvas.width, current_order.canvas.height);
        current_order.is_signature_draw = false;
        current_order.signature = '';
    }
}
