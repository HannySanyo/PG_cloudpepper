/* Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>) */
/* See LICENSE file for full copyright and licensing details. */
/* License URL : <https://store.webkul.com/license.html/> */

import { CustomerDisplay } from "@point_of_sale/customer_display/customer_display";
import { patch } from "@web/core/utils/patch";
import { useState } from "@odoo/owl";
import { batched } from "@web/core/utils/timing";
import { effect } from "@web/core/utils/reactive";
import { useRef } from "@odoo/owl";
import { rpc } from "@web/core/network/rpc";
import { useService } from "@web/core/utils/hooks";

patch(CustomerDisplay.prototype, {
    setup() {
        super.setup(...arguments);
        this.state = useState({
            signature: ''
        })
        this.orm = useService("orm");
        this.my_canvas = useRef('my_canvas');
        window.signature  = this.signature
        this.customerDisplayChannel = new BroadcastChannel("UPDATE_CUSTOMER_DISPLAY");
        effect(
            batched(
                ({
                    signature
                }) => {
                    if (
                        !signature
                    ) {
                        return;
                    }
                    this.sendSignatureData(signature);
                }
            ),
            [this.state]
        );
        this.drawing = false;
    },

    onClickClear(){
        if(this.ctx)
            this.ctx.clearRect(0, 0, this.my_canvas.el.width, this.my_canvas.el.height);
        this.signature_done = false;
    },

    getPosition(event) {
        const canvas = this.my_canvas.el;
        this.ctx = canvas.getContext('2d');
        this.ctx.lineWidth = 1.7;
        this.ctx.lineCap = 'round';
        this.ctx.strokeStyle = '#222222';
        this.ctx.lineJoin = 'round';
        this.signature_done = false;
        this.lastX = 0;
        this.lastY = 0;
        const rect = canvas.getBoundingClientRect(); // Get canvas position and size
    
        // Adjust the coordinates based on the canvas's scale
        const scaleX = canvas.width / rect.width;   // Horizontal scale
        const scaleY = canvas.height / rect.height; // Vertical scale
    
        let x, y;
        if (event.type.includes('touch')) {
            const touch = event.touches[0]; // Handle the first touch point
            x = (touch.clientX - rect.left) * scaleX; // Scale touch position
            y = (touch.clientY - rect.top) * scaleY;
        } else {
            x = (event.clientX - rect.left) * scaleX; // Scale mouse position
            y = (event.clientY - rect.top) * scaleY;
        }
    
        return { x, y };
    },

    startDrawing(event) {
        this.drawing = true;
        const { x, y } = this.getPosition(event);
        [this.lastX, this.lastY] = [x, y];
    },

    stopDrawing() {
        this.drawing = false;
        this.ctx?.beginPath(); // Reset the path to avoid connecting lines between strokes
    },
    
    // to draw on the canvas
    draw(event) {
        if (!this.drawing) return;
    
        const { x, y } = this.getPosition(event);
        this.signature_done = true;
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
        this.ctx.beginPath(); // Reset the path
        this.ctx.moveTo(x, y); // Move to the current position for the next line segment
    
        [this.lastX, this.lastY] = [x, y]; // Update the last coordinates
    },

    async sendSignatureData(signature){
        if (this.session.type === "local") {
            this.customerDisplayChannel.postMessage({test:'test',signature: signature})
        }
        if (this.session.type === "remote") {
            const data = await rpc(
                `/pos-customer-display/${this.session.config_id}`,
                {
                    access_token: this.session.access_token,
                    signature: this.state.signature || false,
                }
            );
            // await this.orm.call("pos.config", "update_customer_signature",[
            //     [this.session.config_id],
            //     this.state.signature,
            //     this.session.access_token
            // ]);
        }
    },

    onSubmitSignature(){
        this.state.signature = this.my_canvas.el.toDataURL('image/png').replace('data:image/png;base64,', "");
    }
})
