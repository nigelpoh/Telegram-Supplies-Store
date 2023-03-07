const Telegraf = require('telegraf')
const { Markup } = Telegraf

const app = new Telegraf('5102681907:AAGp_nCgM9v9GqOfh2GG2qE6tzWL3VcFy7c')
const PAYMENT_TOKEN = '284685063:TEST:NGM0ZWRjMmFhNTVh'

function createInvoice(product) {
    return {
        provider_token: PAYMENT_TOKEN,
        title: 'foundry:supplies order',
        description: 'Perfect supplies from foundry:supplies.',
        currency: 'sgd',
        photo_url: 'https://cdn3.vectorstock.com/i/1000x1000/24/57/customer-service-at-electronics-store-vector-23482457.jpg',
        is_flexible: false,
        need_shipping_address: false,
        prices: [{label:'foundry:supplies order', amount: Cafe.totalPrice}]
    }

}

app.command('start' , ({reply}) => reply('Welcome to foundry:supplies'))
app.startPolling()