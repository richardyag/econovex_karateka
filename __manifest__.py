# -*- coding: utf-8 -*-
{
    'name': 'Karateka GIF',
    'version': '19.0.1.0.0',
    'category': 'Hidden',
    'summary': 'GIF de karateka al enviar facturas/presupuestos y confirmar ventas (entorno test)',
    'author': 'Econovex',
    'website': 'https://www.econovex.com',
    'license': 'LGPL-3',
    'depends': ['web'],
    'assets': {
        'web.assets_backend': [
            'econovex_karateka/static/src/js/karateka_gif.js',
        ],
    },
    'installable': True,
    'application': False,
}
