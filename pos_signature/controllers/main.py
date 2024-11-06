# -*- coding: utf-8 -*-
#################################################################################
#
#   Copyright (c) 2016-Present Webkul Software Pvt. Ltd. (<https://webkul.com/>)
#   See LICENSE file for full copyright and licensing details.
#   License URL : <https://store.webkul.com/license.html/>
#
#################################################################################

from odoo import http, fields
from odoo.http import request
import logging
_logger = logging.getLogger(__name__)

class PosCustomerDisplayController(http.Controller):
    @http.route("/pos-customer-display/<config_id>/", auth="public", type="json", website=True)
    def process_order(self, access_token, signature, config_id):
        pos_config_sudo = request.env['pos.config'].sudo().search([('access_token', '=', access_token)], limit=1)
        pos_config_sudo.update_customer_signature(signature, access_token)
        return True
