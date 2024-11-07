# -*- coding: utf-8 -*-
#################################################################################
# Author      : Webkul Software Pvt. Ltd. (<https://webkul.com/>)
# Copyright(c): 2015-Present Webkul Software Pvt. Ltd.
# All Rights Reserved.
#
#
#
# This program is copyright property of the author mentioned above.
# You can`t redistribute it and/or modify it.
#
#
# You should have received a copy of the License along with this program.
# If not, see <https://store.webkul.com/license.html/>
#################################################################################
{
    "name"              :  "POS Signature",
    "summary"           :  """CUSTOM : The module allows you to save and display the Odoo POS user signature on receipt and on the order in the Odoo backend.Signature|Customer Signature|Custom Signature|Modified Signature""",
    "category"          :  "Point of Sale",
    "version"           :  "1.1.2",
    "sequence"          :  1,
    "author"            :  "Webkul Software Pvt. Ltd.",
    "license"           :  "Other proprietary",
    "website"           :  "https://store.webkul.com/Odoo-POS-Signature.html",
    "description"       :  """  Odoo POS Signature
                                Receipt signature
                                POS user signature
                                User sign on POS
                                POS user signature on receipt
                                Save user sign
                                Save user signature
                                POS Display user signature
                            """,
    "live_test_url"     :  "http://odoodemo.webkul.com/?module=pos_signature&custom_url=/pos/web/#action=pos.ui",
    "depends"           :  ['point_of_sale'],
    "data"              :  ['views/pos_customer_signature_view.xml',
                            'views/pos_config_view.xml',
                            'views/report_invoice.xml',
                            ],
    "assets"            :  {
                            'point_of_sale._assets_pos': [
                                    'pos_signature/static/src/components/*/**',
                                    'pos_signature/static/src/app/*/**',
                                    'web/static/lib/jquery/jquery.js',
                                    'pos_signature/static/src/app/popups/waiting_for_signature_popup/waiting_for_signature_popup.js',
                                    'pos_signature/static/src/app/popups/waiting_for_signature_popup/waiting_for_signature_popup.xml',
                                    'pos_signature/static/src/app/popups/waiting_for_signature_popup/popup.css',
                                ],
                            'point_of_sale.customer_display_assets': [
                                    'pos_signature/static/src/overrides/customer_display_overrides/customer_display.js',
                                    'pos_signature/static/src/overrides/customer_display_overrides/customer_display.xml'
                                ],
                            },
    "images"            :  ['static/description/Banner.png'],
    "application"       :  True,
    "installable"       :  True,
    "auto_install"      :  False,
    "price"             :  49,
    "currency"          :  "USD",
    "pre_init_hook"     :  "pre_init_check",
}
