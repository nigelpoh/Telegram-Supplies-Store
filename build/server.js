'use strict';

const express = require('express');
const bodyParser = require("body-parser");
const { Telegraf } = require('telegraf');
const request = require('request');
const { create } = require ('express-handlebars');

const PORT = 8080;
const HOST = '172.30.0.33';
const DB = "mongodb://admin:password@172.30.0.34:27017/"
const PROVIDER_TOKEN = "350862534:LIVE:ODU3NzgwODkyOWFj"
const MongoClient = require('mongodb').MongoClient;
const bot = new Telegraf('5102681907:AAGp_nCgM9v9GqOfh2GG2qE6tzWL3VcFy7c');

bot.startPolling();

const app = express();
const handlebars = create({
  helpers: {
    moneyFormatConverter(amount, type) { 
      if(type == "telegram"){
        return (parseFloat(amount) * 1000).toFixed(); 
      }else if(type == "present"){
        return "$" + parseFloat(amount).toFixed(2); 
      }
    },
    imageURIConcatenator(item_ref_name, type){
      if(type == "tgs"){
        return "/img/cafe/" + item_ref_name + ".tgs"
      }else if(type == "silo"){
        return "background-image: url('/img/cafe/" + item_ref_name + "_silo.svg')"
      }else if(type == "img"){
        return "/img/cafe/" + item_ref_name + "_148.png"
      }else if(type == "img_real"){
        return "/img/cafe/" + item_ref_name + "_real.png"
      }
    },
    idNameFormatter(ref_name, type){
      if(type == "tgs"){
        return ref_name + "_tgs";
      }else if(type == "content"){
        return ref_name + "_content";
      }
    },
    deliveryCleanup(del_type, del_mode){
      if(del_type == "postal_delivery"){
        return del_type.replace("_", " ") + " (" + del_mode.split(" (")[0] + ")";
      }else if(del_type == "self_collection"){
        return del_type.replace("_", " ");
      }
    },
    itemsCleanup(items){
      var itemsString = ""
      for(var i = 0; i < items.length; i++){
        itemsString += items[i].label + " ($" + (items[i].amount / 100).toFixed(2) + ")"
        if(i != items.length - 1){
          itemsString += ", "
        }
      }
      return itemsString;
    },
    deliveryProcessor(delivery_type){
      return (delivery_type == "self_collection" ? 1 : 2).toString();
    }
  }
});

bot.command('start', ctx => {
  bot.telegram.sendMessage(
    ctx.chat.id,
    '*Hello there!*\n\nWelcome to foundry::supplies, your ready electronics supplies store. What would you like to do?\n\n_If the buttons below does not display properly, please update your telegram app to the latest version. This bot\'s functions might be limited on desktop and web._\n\nIf you have any queries, please contact us at @hubertleesw.',
    {
      parse_mode: 'markdown',
      reply_markup: {
        inline_keyboard: [
          [{  
            text: "Visit the Store",
            web_app: {
              url: "https://supplies.foundrycollective.io"
            }
          }],
          [{  
            text: "Check Orders",
            callback_data: "check_orders"
          }]    
        ]      
      }
    }
  )
})

bot.command('orders', ctx => {
  bot.telegram.sendMessage(
    ctx.chat.id, 
    'What do you want to do?',
    {
      parse_mode: 'markdown',
      reply_markup: {
        resize_keyboard : true,
        inline_keyboard: [
          [{  
            text: "Check Order Status",
            web_app: {
              url: "https://supplies.foundrycollective.io/check_order_status?user=" + ctx.message.from.id
            }
          }],
          [{  
            text: "Schedule Self Collection",
            callback_data: "self_collect_query"
          }]
        ]
      }
    }
  )
})

bot.on("callback_query", (query) => {
  if(query.update.callback_query.data == "self_collect_query"){
    bot.telegram.answerCbQuery(query.update.callback_query.id, "");
    bot.telegram.sendMessage(
      query.from.id,
      "Please contact @hubertleesw to schedule your collection with us. Thanks!"
    )
  }else if(query.update.callback_query.data == "check_orders"){
    bot.telegram.answerCbQuery(query.update.callback_query.id, "");
    bot.telegram.sendMessage(
      query.from.id, 
      'What do you want to do?',
      {
        parse_mode: 'markdown',
        reply_markup: {
          resize_keyboard : true,
          inline_keyboard: [
            [{  
              text: "Check Order Status",
              web_app: {
                url: "https://supplies.foundrycollective.io/check_order_status?user=" + query.from.id
              }
            }],
            [{  
              text: "Schedule Self Collection",
              callback_data: "self_collect_query"
            }]
          ]
        }
      }
    )
  }else if(query.update.callback_query.data.split("@")[0] == "ORDER_ID"){
    bot.telegram.answerCbQuery(query.update.callback_query.id, "Order Processed");
    var queryDataCallback = query.update.callback_query.data.split("@")
    MongoClient.connect(DB, function(err, db) {
      if (err) throw err;
      var DB_FS = db.db("foundrysupplies");
      var query_string = { id: queryDataCallback[2] };
      DB_FS.collection("unconfirmed_orders").find(query_string).toArray(function(err, result) {
        if (err) throw err;
        if (result.length != 1){
          throw "Order Corrupt"
        }
        if(queryDataCallback[1] == 'postal_delivery'){
          bot.telegram.sendInvoice(
            query.update.callback_query.from.id, 
            {
              title: "Your Order", 
              description: "Convenient Electronics",
              payload: queryDataCallback[2],
              provider_token: PROVIDER_TOKEN,
              currency: "SGD",
              prices: result[0].prices_obj,
              photo_url: "https://supplies.foundrycollective.io/img/cafe/invoice_image.png",
              need_email: true,
              send_email_to_provider: true,
              need_shipping_address: true,
              is_flexible: true
            }
          )
        }else if(queryDataCallback[1] == 'self_collection'){
          bot.telegram.sendInvoice(
            query.update.callback_query.from.id, 
            {
              title: "Your Order", 
              description: "Convenient Electronics",
              payload: queryDataCallback[2],
              provider_token: PROVIDER_TOKEN,
              currency: "SGD",
              prices: result[0].prices_obj,
              photo_url: "https://supplies.foundrycollective.io/img/cafe/invoice_image.png",
              need_email: true,
              send_email_to_provider: true,
              need_phone_number: true
            }
          )
        }
        db.close();
      });
    });
  }
})

bot.on('shipping_query', (msg_shipping) => {
  var shipping_possible = false;
  if(msg_shipping.update.shipping_query.shipping_address.country_code == 'SG'){
    request('https://developers.onemap.sg/commonapi/search?searchVal=' + msg_shipping.update.shipping_query.shipping_address.post_code + '&returnGeom=N&getAddrDetails=Y', function (error, response, body) {
      MongoClient.connect(DB, function(err, db) {
        if (err) throw err;
        var DB_FS = db.db("foundrysupplies");
        DB_FS.collection("shipping").find({}).toArray(function(err, shipping_options){
          var shipping_options_tele = []
          for(var i = 0; i < shipping_options.length; i++){
            shipping_options_tele.push({
              id: shipping_options[i].id,
              title: shipping_options[i].title,
              prices: [
                  {
                      label: shipping_options[i].description,
                      amount: (shipping_options[i].price * 100).toFixed()
                  }
              ]
            })
          }
          if (!error && response.statusCode == 200) {
            const parsed_response_data = JSON.parse(body);
            if(parseInt(parsed_response_data.found) > 0){ 
              if(parsed_response_data.results.filter(entry => entry.POSTAL == msg_shipping.update.shipping_query.shipping_address.post_code).length > 0){
                shipping_possible = true;
              }
            }
            bot.telegram.answerShippingQuery(
              msg_shipping.update.shipping_query.id,
              shipping_possible,
              shipping_options_tele,
              "Please check your postal code again. Shipping is only currently possible within Singapore."
            )
          }else{
            bot.telegram.answerShippingQuery(
              msg_shipping.update.shipping_query.id,
              false,
              shipping_options_tele,
              "We are currently facing some technical difficulties. Sorry for the inconvenience. Please try again later."
            )
            console.error("ERROR: STATUS CODE " + response.statusCode.toString() + " – " + error.toString())
          }
        })
      })
    })
  }
})

bot.on('pre_checkout_query', (ctx) => {
  var query = { id: ctx.update.pre_checkout_query.invoice_payload };
  MongoClient.connect(DB, function(err, db) {
    if (err) throw err;
    var DB_FS = db.db("foundrysupplies");
    if(typeof ctx.update.pre_checkout_query.order_info.shipping_address !== 'undefined'){
      DB_FS.collection("shipping").find({}).toArray(function(err, shipping_options){
        var order = { 
          $set:{
            delivery_type: "postal_delivery",
            delivery_mode: shipping_options.find(({id}) => id === ctx.update.pre_checkout_query.shipping_option_id).title + " ($ " + shipping_options.find(({id}) => id === ctx.update.pre_checkout_query.shipping_option_id).price.toFixed(2) + ")",
            delivery_address: JSON.stringify(ctx.update.pre_checkout_query.order_info.shipping_address),
            delivery_status: "not_dispatched",
            email: ctx.update.pre_checkout_query.order_info.email,
            phone_number: null,
            orderCompleted: false,
            receiptSent: false
          }
        };
        MongoClient.connect(DB, function(err, db) {
          if (err) throw err;
          var DB_FS_inner = db.db("foundrysupplies");
          DB_FS_inner.collection("unconfirmed_orders").updateOne(query, order, function(err, res) {
            if (err) throw err;
            db.close();
          });
        })
      });
    }else if((typeof ctx.update.pre_checkout_query.order_info.phone_number) !== 'undefined'){
      var order = { 
        $set: {
          delivery_type: "self_collection",
          delivery_mode: null,
          delivery_address: null,
          delivery_status: null,
          email: ctx.update.pre_checkout_query.order_info.email,
          phone_number: ctx.update.pre_checkout_query.order_info.phone_number,
          orderCompleted: false,
          receiptSent: false
        }
      };
      DB_FS.collection("unconfirmed_orders").updateOne(query, order, function(err, res) {
        if (err) throw err;
        db.close();
      });
    }else{
      throw "Error"
    }
  });
  ctx.answerPreCheckoutQuery(true)
})

bot.on("message", (msg_query) => {
  if(msg_query.message.successful_payment != undefined){
    var query = { id: msg_query.message.successful_payment.invoice_payload };
    const order_date = new Date();
    const time_zone_offset = order_date.getTimezoneOffset() * 60 * 1000;
    const local_date = new Date(order_date.getTime() - time_zone_offset);
    const local_date_str = local_date.toISOString().slice(0, 19).replace(/-/g, "/").replace("T", " ");
    MongoClient.connect(DB, function(err, db) {
      if (err) throw err;
      var DB_FS = db.db("foundrysupplies");
      DB_FS.collection("unconfirmed_orders").find(query).toArray(function(err, result) {
        if (err) throw err;
        if (result.length != 1){
          throw "Order Corrupt"
        }
        var order = { 
          id: result[0].id, 
          user_id: result[0].user_id,
          username: result[0].username,
          email: result[0].email,
          prices: result[0].prices,
          delivery_type: result[0].delivery_type,
          delivery_mode: result[0].delivery_mode,
          delivery_address: result[0].delivery_address,
          delivery_status: result[0].delivery_status,
          phone_number: result[0].phone_number,
          add_request: result[0].add_request, 
          date_ordered: local_date_str,
          receiptSent: result[0].receiptSent,
          orderCompleted: result[0].orderCompleted,
          telegram_payment_charge_id: msg_query.message.successful_payment.telegram_payment_charge_id,
          provider_payment_charge_id: msg_query.message.successful_payment.provider_payment_charge_id,
          total_charge: msg_query.message.successful_payment.currency + " " + (msg_query.message.successful_payment.total_amount / 100).toFixed(2),
          prices_obj: result[0].prices_obj 
        };
        MongoClient.connect(DB, function(err, db) {
          if (err) throw err;
          var DB_FS_inner = db.db("foundrysupplies");
          DB_FS_inner.collection("confirmed_orders").insertOne(order, function(err, _) {
            if (err) throw err;
            db.close();
          });
        })
        MongoClient.connect(DB, function(err, db) {
          if (err) throw err;
          var DB_FS = db.db("foundrysupplies");
          DB_FS.collection("unconfirmed_orders").deleteOne(query, function(err, _) {
            if (err) throw err;
            db.close();
          });
        })
        if(result[0].delivery_type == "postal_delivery"){
          setTimeout(() => {
            bot.telegram.sendMessage(
              msg_query.message.from.id, 
              "*Thanks for ordering from us!*\n\nA receipt will be sent to your email shortly. Your items should arrive within 5 working days. You can use this bot to check your order status (using /orders). We hope to see you soon!",
              {
                parse_mode: "Markdown"
              }
            )
          }, 100)
        }else if(result[0].delivery_type == "self_collection"){
          bot.telegram.sendMessage(
            msg_query.message.from.id, 
            "*Thanks for ordering from us!*\n\nA receipt will be sent to your email shortly. Please arrange your collection date and time with us at @hubertleesw and drop by SUTD's Entrepreneurship Centre to collect your items. We hope to see you soon!",
            {
              parse_mode: "Markdown"
            }
          )
          setTimeout(() => {
            bot.telegram.sendLocation(
              msg_query.message.from.id, 
              1.3398976,
              103.9649364
            )
          }, 100)
        }
      })
    })
  }
})

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');
app.set('layout', __dirname + '/views/layouts');

app.use(express.static('static'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  MongoClient.connect(DB, function(err, db) {
    if (err) throw err;
    var DB_FS = db.db("foundrysupplies");
    DB_FS.collection("prices").find({}).toArray(function(err, result) {
      if (err) throw err;
      res.render('main', {layout : 'index', storeStuff: result});
    })
  });
});

app.get('/check_order_status', (req, res) => {
  if(req.query.user != undefined){
    var query = { user_id: req.query.user, orderCompleted: false };
    MongoClient.connect(DB, function(err, db) {
      if (err) throw err;
      var DB_FS = db.db("foundrysupplies");
      DB_FS.collection("confirmed_orders").find(query).toArray(function(err, orders){
        res.render('check_order_status', {layout : 'index', orders: orders});
      })
    })
  }else{
    res.send({"data": "Error"})
  }
});

app.post('/api', (req, res) => {
  if(req.body.method == "submitOrder"){
    var order_summary = "*Order Summary:* \n\n"
    MongoClient.connect(DB, function(err, db) {
      if (err) throw err;
      var DB_FS = db.db("foundrysupplies");
      DB_FS.collection("unconfirmed_orders").deleteMany(
        { 
          "date": { 
            $lt: Date.now() - 10 * 60 * 1000 
          } 
        }
      )
      DB_FS.collection("prices").find({}).toArray(function(err, result_prices) {
        if (err) throw err;
        var price_list = []
        for(let i = 0; i < JSON.parse(req.body.order_data).length; i++){
          var current_obj = result_prices.find(function(obj){
            return obj.id == JSON.parse(req.body.order_data)[i].id
          })
          var current_item = current_obj.name + " x" + JSON.parse(req.body.order_data)[i].count.toString();
          var current_item_price = parseFloat(current_obj.price) * parseFloat(JSON.parse(req.body.order_data)[i].count);
          order_summary += current_item + " – *$" + current_item_price.toFixed(2) + "*\n"
          price_list.push({label: current_item, amount: parseInt(current_item_price * 100)})
        }
        order_summary += "\n*Final Price: " + req.body.total_price + "*"
        bot.telegram.answerWebAppQuery(JSON.parse(req.body._auth).query_id, JSON.stringify({
          type: "article",
          id: JSON.parse(req.body._auth).query_id,
          title: "Order Details",
          input_message_content: {
            message_text: order_summary,
            parse_mode: "markdown"
          }
        }))

        setTimeout(function(){
          var orderID = JSON.parse(req.body._auth).user.id.toString() + "#" + Date.now().toString();
          MongoClient.connect(DB, function(err, db) {
            if (err) throw err;
            var DB_FS = db.db("foundrysupplies");
            var order = { 
              id: orderID, 
              date: Date.now(),
              user_id: JSON.parse(req.body._auth).user.id.toString(),
              username: JSON.parse(req.body._auth).user.username,
              email: null, 
              prices: JSON.stringify(price_list),
              delivery_type: null,
              orderCompleted: false,
              receiptSent: false,
              phone_number: null,
              delivery_address: null,
              delivery_status: null,
              add_request: req.body.comment, 
              telegram_payment_charge_id: null,
              provider_payment_charge_id: null,
              total_charge: 0,
              prices_obj: price_list 
            };
            DB_FS.collection("unconfirmed_orders").insertOne(order, function(err, _) {
              if (err) throw err;
              db.close();
            });
          });
          bot.telegram.sendMessage(
            JSON.parse(req.body._auth).user.id, 
            "Please choose your delivery option. Self collection is currently only available @ SUTD Entrepreneurship Centre. Delivery charges may apply for the Delivery option.",
            {
              reply_markup: {
                inline_keyboard: [
                  [
                    {text: "Self Collection", callback_data: 'ORDER_ID@self_collection@' + orderID},
                    {text: "Delivery", callback_data: 'ORDER_ID@postal_delivery@' + orderID}
                  ]
                ]
              }
            }
          )    
        },300);
      })
      res.send({"ok": 200})
    });
  }else if(req.body.method == "checkOrderStatus"){
    MongoClient.connect(DB, function(err, db) {
      if (err) throw err;
      var DB_FS = db.db("foundrysupplies");
      var query = { id: req.body.order_id };
      DB_FS.collection("confirmed_orders").find(query).toArray(function(err, result) {
        if (err) throw err;
        if (result.length != 1){
          throw "Order Corrupt"
        }
        if(result[0].delivery_type == "postal_delivery"){
          if(result[0].delivery_status == "not_dispatched"){
            bot.telegram.sendMessage(
              JSON.parse(req.body._auth).user.id, 
              "*Delivery Mode: Postal Delivery (" + result[0].delivery_mode.split(" (")[0] + ")* \n_Order ID: " +  result[0].id + "_\n\nWe are currently preparing your items for shipment. Your items should arrive within 3 to 5 working days.",
              {
                parse_mode: "Markdown"
              }
            );
          }else if(result[0].delivery_status == "dispatched"){
            bot.telegram.sendMessage(
              JSON.parse(req.body._auth).user.id, 
              "*Delivery Mode: Postal Delivery (" + result[0].delivery_mode.split(" (")[0] + ")* \n_Order ID: " +  result[0].id + "_\n\nYour item has been shipped. It should arrive within 3 working days.",
              {
                parse_mode: "Markdown"
              }
            );
          }
        }else if(result[0].delivery_type == "self_collection"){
          bot.telegram.sendMessage(
            JSON.parse(req.body._auth).user.id, 
            "*Delivery Mode: Self Collection* \n\n The collection location will be at SUTD's Entreprenuership Centre. Please contact @hubertleesw to arrange your self collection.",
            {
              parse_mode: "Markdown"
            }
          );
          setTimeout(() => {
            bot.telegram.sendLocation(
              msg_query.message.from.id, 
              1.3398976,
              103.9649364
            )
          }, 100)
        }
        db.close();
      })
      res.send({"ok": 200});
    })
  }
})

app.listen(PORT, HOST);