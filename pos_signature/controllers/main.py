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
        """
        Endpoint to process a POS order and update the customer's signature.
        :param access_token: Access token for POS authentication.
        :param signature: Base64 encoded signature data.
        :param config_id: ID of the POS configuration.
        :return: JSON response indicating success or failure.
        """
        try:
            pos_config_sudo = request.env['pos.config'].sudo().search([('access_token', '=', access_token)], limit=1)
            if pos_config_sudo:
                pos_config_sudo.update_customer_signature(signature, access_token)
                return {'success': True, 'message': 'Signature updated successfully'}
            else:
                _logger.warning("POS config not found for access token: %s", access_token)
                return {'success': False, 'message': 'POS config not found for given access token'}
        except Exception as e:
            _logger.error("Error processing order: %s", e)
            return {'success': False, 'error': 'Unexpected error occurred while processing order.'}

    @http.route('/pos/get_sales_tax', type='json', auth='user', methods=['POST'])
    def get_sales_tax(self, id=None):
        """
        Endpoint to retrieve sales tax information for a POS order.
        :param id: ID of the POS order for which to retrieve tax info.
        :return: JSON response with 'sales_tax' amount or an error message.
        """
        _logger.info("Fetching sales tax for order ID: %s", id)

        if not id:
            _logger.warning("Order ID not provided for sales tax retrieval.")
            return {'error': 'Order ID not provided'}

        try:
            order = self._get_order_by_id(id)
            if not order:
                return {'error': 'Order not found'}

            sales_tax = order.amount_tax
            _logger.info("Sales tax for order ID %s: %s", id, sales_tax)
            return {'sales_tax': sales_tax}
        except Exception as e:
            _logger.error("Error fetching sales tax for order ID %s: %s", id, e)
            return {'error': 'An error occurred while fetching sales tax.'}

    @http.route('/pos/get_order_id', type='json', auth='user', methods=['POST'])
    def get_order_id(self, amount=None):
        """
        Endpoint to retrieve order ID based on amount.
        :param amount: Total amount of the POS order for which to retrieve the ID.
        :return: JSON response with the 'id' of the matching order or an error message.
        """
        _logger.info("Fetching order ID for amount: %s", amount)

        if amount is None:
            _logger.warning("Amount not provided for order ID retrieval.")
            return {'error': 'Amount not provided'}

        try:
            order = request.env['pos.order'].sudo().search([('amount_total', '=', amount)], limit=1)
            if not order:
                _logger.warning("Order not found for amount: %s", amount)
                return {'error': 'Order not found'}
            
            _logger.info("Order ID %s found for amount: %s", order.id, amount)
            return {'id': order.id}
        except Exception as e:
            _logger.error("Error fetching order ID for amount %s: %s", amount, e)
            return {'error': 'An error occurred while fetching the order ID.'}

    def _get_order_by_id(self, order_id):
        """
        Helper method to retrieve an order by ID.
        :param order_id: The ID of the POS order.
        :return: POS order record or None if not found.
        """
        try:
            order = request.env['pos.order'].sudo().search([('id', '=', int(order_id))], limit=1)
            if order:
                _logger.info("Order retrieved successfully for ID: %s", order_id)
            else:
                _logger.warning("Order with ID %s not found.", order_id)
            return order
        except Exception as e:
            _logger.error("Error retrieving order with ID %s: %s", order_id, e)
            return None