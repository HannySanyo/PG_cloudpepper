# -*- coding: utf-8 -*-
#################################################################################
#
#   Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>)
#   See LICENSE file for full copyright and licensing details.
#   License URL : <https://store.webkul.com/license.html/>
#
#################################################################################
from odoo import api, fields, models
import logging
import secrets

_logger = logging.getLogger(__name__)

class PosOrder(models.Model):
    _inherit = 'pos.order'

    signature = fields.Binary(string='Customer Signature', readonly=True)
    
class PosConfig(models.Model):
    _inherit = "pos.config"

    enable_pos_signature = fields.Boolean("Enable POS Signature", default=True)
    enable_signature_in_invoice = fields.Boolean("Show Signature in Invoice", default=True)
    set_signature_mandatory = fields.Boolean("Set Signature as Mandatory", default=True)
    add_signature_from = fields.Selection([('payment_screen', 'Payment Screen'), ('cutomer_display', 'Customer Display')], string='Add signature from', readonly=False, default='payment_screen')
    show_total_with_terms = fields.Boolean(
        string="Show Total with Terms",
        help="the total amount and Terms and Conditions message above the signature box."
    )
    terms_conditions_link = fields.Char(
        string="Terms and Conditions Link",
        help="URL link for the Terms and Conditions. This link will appear on the signature screen."
    )
    def check_for_invoice(self, config_id):
        record = self.search([('id', '=', config_id)])
        for rec in record:
            if(rec.enable_pos_signature == True and rec.enable_signature_in_invoice == True):
                return True
            else:
                return False

    def update_customer_signature(self, signature, access_token):
        self.ensure_one()
        if not access_token or not secrets.compare_digest(self.access_token, access_token):
            return
        self._notify("UPDATE_CUSTOMER_SIGNATURE", signature)


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    is_pos_signature = fields.Boolean(related="pos_config_id.enable_pos_signature", readonly=False, default=True)
    is_signature_in_invoice = fields.Boolean(related="pos_config_id.enable_signature_in_invoice", readonly=False, default=True)
    is_signature_mandatory= fields.Boolean(related="pos_config_id.set_signature_mandatory", readonly=False, default=True)
    pos_add_signature_from = fields.Selection(related='pos_config_id.add_signature_from', readonly=False)
    pos_show_total_with_terms= fields.Boolean(related="pos_config_id.show_total_with_terms", readonly=False, default=True)
    pos_terms_conditions_link= fields.Char(related="pos_config_id.terms_conditions_link", readonly=False,)
