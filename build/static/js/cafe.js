let Cafe = {
  canPay: false,
  modeOrder: false,
  paymentClicks: 0,
  totalPrice: 0,
  apiUrl: "",
  userId: "",
  userHash: "",
  isClosed: false,
  init: function (apiUrl, userId, userHash){
    Telegram.WebApp.ready();
    Cafe.apiUrl = apiUrl;
    Cafe.userId = userId;
    Cafe.userHash = userHash;
    Cafe.initLotties();
    $('body').show();

    if (!Telegram.WebApp.initDataUnsafe || !Telegram.WebApp.initDataUnsafe.query_id) {
      Cafe.isClosed = true;
      $('body').addClass('closed');
      Cafe.showStatus('Cafe is temporarily closed');
      return;
    }
    $('.js-item-lottie').on('click', Cafe.eLottieClicked);
    $('.js-item-incr-btn').on('click', Cafe.eIncrClicked);
    $('.js-item-decr-btn').on('click', Cafe.eDecrClicked);
    $('.js-order-edit').on('click', Cafe.eEditClicked);
    $('.js-status').on('click', Cafe.eStatusClicked);
    $('.order-status-button').on('click', Cafe.eOrderStatusClicked);
    $('.js-order-comment-field').each(function() {
      autosize(this);
    });
    Telegram.WebApp.MainButton.setParams({
      text_color: '#fff'
    }).onClick(Cafe.mainBtnClicked);
    initRipple();
  },
  initLotties: function() {
    $('.js-item-lottie').each(function() {
      RLottie.init(this, {
        maxDeviceRatio: 2,
        cachingModulo: 3,
        noAutoPlay: true
      });
    });
  },
  eLottieClicked: function(e) {
    if (Cafe.isClosed) {
      return false;
    }
    Telegram.WebApp.expand();
    const currentItemRef = $(this).data("item-ref");
    setTimeout(() => {
      $("#"+currentItemRef + "_content").scrollTop(0);
    }, 100)
    document.getElementById(currentItemRef).classList.add('is-visible');
    RLottie.init(document.getElementById(currentItemRef + "_tgs"), {
      maxDeviceRatio: 2,
      cachingModulo: 3,
      noAutoPlay: true
    });
    RLottie.setVisible(document.getElementById(currentItemRef + "_tgs"), true);
    RLottie.playOnce(document.getElementById(currentItemRef + "_tgs"))
    let LottieRunIntervals = setInterval(() => RLottie.playOnce(document.getElementById(currentItemRef + "_tgs")), 5000);
    $(".close-modal").on('click', function(){
      RLottie.setVisible(document.getElementById(currentItemRef + "_tgs"), false);
      clearInterval(LottieRunIntervals);
      document.getElementById(currentItemRef).classList.remove('is-visible');
    })
  },
  eIncrClicked: function(e) {
    e.preventDefault();
    var itemEl = $(this).parents('.js-item');
    Cafe.incrClicked(itemEl, 1);
  },
  eDecrClicked: function(e) {
    e.preventDefault();
    var itemEl = $(this).parents('.js-item');
    Cafe.incrClicked(itemEl, -1);
  },
  eEditClicked: function(e) {
    e.preventDefault();
    Cafe.toggleMode(false);
  },
  eOrderStatusClicked: function(){
    var params = {
      order_id: $(this).data("order-id")
    }
    if (Cafe.userId && Cafe.userHash) {
      params.user_id = Cafe.userId;
      params.user_hash = Cafe.userHash;
    }
    Cafe.toggleLoading(true);
    Cafe.apiRequest('checkOrderStatus', params, function(result) {
      Cafe.toggleLoading(false);
      if (result.ok) {
        Telegram.WebApp.close();
      }
      if (result.error) {
        Cafe.showStatus(result.error);
      }
    });
  },
  getOrderItem: function(itemEl) {
    var id = itemEl.data('item-id');
    return $('.js-order-item').filter(function() {
      return ($(this).data('item-id') == id);
    });
  },
  updateItem: function(itemEl, delta) {
    var price = +itemEl.data('item-price');
    var count = +itemEl.data('item-count') || 0;
    var counterEl = $('.js-item-counter', itemEl);
    counterEl.text(count ? count : 1);
    var isSelected = itemEl.hasClass('selected');
    if (!isSelected && count > 0) {
      $('.js-item-lottie', itemEl).each(function() {
        RLottie.playOnce(this);
      });
    }
    var anim_name = isSelected ? (delta > 0 ? 'badge-incr' : (count > 0 ? 'badge-decr' : 'badge-hide')) : 'badge-show';
    var cur_anim_name = counterEl.css('animation-name');
    if ((anim_name == 'badge-incr' || anim_name == 'badge-decr') && anim_name == cur_anim_name) {
      anim_name += '2';
    }
    counterEl.css('animation-name', anim_name);
    itemEl.toggleClass('selected', count > 0);

    var orderItemEl = Cafe.getOrderItem(itemEl);
    var orderCounterEl = $('.js-order-item-counter', orderItemEl);
    orderCounterEl.text(count ? count : 1);
    orderItemEl.toggleClass('selected', count > 0);
    var orderPriceEl = $('.js-order-item-price', orderItemEl);
    var item_price = count * price;
    orderPriceEl.text(Cafe.formatPrice(item_price));

    Cafe.updateTotalPrice();
  },
  incrClicked: function(itemEl, delta) {
    if (Cafe.isLoading || Cafe.isClosed) {
      return false;
    }
    var count = +itemEl.data('item-count') || 0;
    count += delta;
    if (count < 0) {
      count = 0;
    }
    itemEl.data('item-count', count);
    Cafe.updateItem(itemEl, delta);
  },
  formatPrice: function(price) {
    return '$' + Cafe.formatNumber(price / 1000, 2, '.', ',');
  },
  formatNumber: function(number, decimals, decPoint, thousandsSep) {
    number = (number + '').replace(/[^0-9+\-Ee.]/g, '')
    var n = !isFinite(+number) ? 0 : +number
    var prec = !isFinite(+decimals) ? 0 : Math.abs(decimals)
    var sep = (typeof thousandsSep === 'undefined') ? ',' : thousandsSep
    var dec = (typeof decPoint === 'undefined') ? '.' : decPoint
    var s = ''
    var toFixedFix = function (n, prec) {
      if (('' + n).indexOf('e') === -1) {
        return +(Math.round(n + 'e+' + prec) + 'e-' + prec)
      } else {
        var arr = ('' + n).split('e')
        var sig = ''
        if (+arr[1] + prec > 0) {
          sig = '+'
        }
        return (+(Math.round(+arr[0] + 'e' + sig + (+arr[1] + prec)) + 'e-' + prec)).toFixed(prec)
      }
    }
    s = (prec ? toFixedFix(n, prec).toString() : '' + Math.round(n)).split('.')
    if (s[0].length > 3) {
      s[0] = s[0].replace(/\B(?=(?:\d{3})+(?!\d))/g, sep)
    }
    if ((s[1] || '').length < prec) {
      s[1] = s[1] || ''
      s[1] += new Array(prec - s[1].length + 1).join('0')
    }
    return s.join(dec)
  },
  updateMainButton: function() {
    var mainButton = Telegram.WebApp.MainButton;
    if (Cafe.modeOrder) {
      if (Cafe.isLoading) {
        mainButton.setParams({
          is_visible: true,
          color: '#65c36d'
        }).showProgress();
      } else {
        mainButton.setParams({
          is_visible: !!Cafe.canPay,
          text: 'PAY ' + Cafe.formatPrice(Cafe.totalPrice),
          color: '#31b545'
        }).hideProgress();
      }
    } else {
      mainButton.setParams({
        is_visible: !!Cafe.canPay,
        text: 'VIEW ORDER',
        color: '#31b545'
      }).hideProgress();
    }
  },
  updateTotalPrice: function() {
    var total_price = 0;
    $('.js-item').each(function() {
      var itemEl = $(this)
      var price = +itemEl.data('item-price');
      var count = +itemEl.data('item-count') || 0;
      total_price += price * count;
    });
    Cafe.canPay = total_price > 0;
    Cafe.totalPrice = total_price;
    Cafe.updateMainButton();
  },
  getOrderData: function() {
    var order_data = [];
    $('.js-item').each(function() {
      var itemEl = $(this)
      var id    = itemEl.data('item-id');
      var count = +itemEl.data('item-count') || 0;
      if (count > 0) {
        order_data.push({id: id, count: count});
      }
    });
    return JSON.stringify(order_data);
  },
  toggleMode: function(mode_order) {
    Cafe.modeOrder = mode_order;
    var anim_duration, match;
    try {
      anim_duration = window.getComputedStyle(document.body).getPropertyValue('--page-animation-duration');
      if (match = /([\d\.]+)(ms|s)/.exec(anim_duration)) {
        anim_duration = +match[1];
        if (match[2] == 's') {
          anim_duration *= 1000;
        }
      } else {
        anim_duration = 400;
      }
    } catch (e) {
      anim_duration = 400;
    }
    if (mode_order) {
      var height = $('.cafe-items').height();
      $('.js-item-lottie').each(function() {
        RLottie.setVisible(this, false);
      });
      $('.cafe-order-overview').show();
      $('.cafe-items').css('maxHeight', height).redraw();
      $('body').addClass('order-mode');
      $('.js-order-comment-field').each(function() {
        autosize.update(this);
      });
      Telegram.WebApp.expand();
      setTimeout(function() {
        $('.js-item-lottie').each(function() {
          RLottie.setVisible(this, true);
        });
      }, anim_duration);
    } else {
      $('.js-item-lottie').each(function() {
        RLottie.setVisible(this, false);
      });
      $('body').removeClass('order-mode');
      setTimeout(function() {
        $('.cafe-items').css('maxHeight', '');
        $('.cafe-order-overview').hide();
        $('.js-item-lottie').each(function() {
          RLottie.setVisible(this, true);
        });
      }, anim_duration);
    }
    Cafe.updateMainButton();
  },
  toggleLoading: function(loading) {
    Cafe.isLoading = loading;
    Cafe.updateMainButton();
    $('body').toggleClass('loading', !!Cafe.isLoading);
    Cafe.updateTotalPrice();
  },
  mainBtnClicked: function() {
    if (!Cafe.canPay || Cafe.isLoading || Cafe.isClosed) {
      return false;
    }
    if (Cafe.modeOrder == true && Cafe.paymentClicks == 0) {
      var comment = $('.js-order-comment-field').val();
      var params = {
        order_data: Cafe.getOrderData(),
        comment: comment,
        total_price: Cafe.formatPrice(Cafe.totalPrice)
      };
      if (Cafe.userId && Cafe.userHash) {
        params.user_id = Cafe.userId;
        params.user_hash = Cafe.userHash;
      }
      Cafe.toggleLoading(true);
      Cafe.paymentClicks += 1;
      Cafe.apiRequest('submitOrder', params, function(result) {
        Cafe.toggleLoading(false);
        if (result.ok) {
          Telegram.WebApp.close();
        }
        if (result.error) {
          Cafe.showStatus(result.error);
        }
      });
    } else {
      Cafe.toggleMode(true);
    }
  },
  apiRequest: function(method, data, onCallback) {
    var authData = Telegram.WebApp.initData || '5102681907:AAGp_nCgM9v9GqOfh2GG2qE6tzWL3VcFy7c';
    var authDeconstruct = new URLSearchParams(decodeURI(authData))
    var authDeconstructObj = {}
    for(var keyval of authDeconstruct.entries()) {
      authDeconstructObj[keyval[0]] = keyval[1];
    }
    authDeconstructObj.user = JSON.parse(decodeURI(authDeconstructObj.user));
    $.ajax(Cafe.apiUrl, {
      type: 'POST',
      data: $.extend(data, {_auth: JSON.stringify(authDeconstructObj), method: method}),
      dataType: 'json',
      xhrFields: {
        withCredentials: true
      },
      success: function(result) {
        onCallback && onCallback(result);
      },
      error: function(xhr) {
        onCallback && onCallback({error: JSON.stringify(xhr) } );
      }
    });
  },
  eStatusClicked(){
    Cafe.hideStatus();
  },
  showStatus: function(text) {
    clearTimeout(Cafe.statusTo);
    $('.js-status').text(text).addClass('shown');
    if (!Cafe.isClosed) {
      Cafe.statusTo = setTimeout(function(){ Cafe.hideStatus(); }, 2500);
    }
  },
  hideStatus: function() {
    clearTimeout(Cafe.statusTo);
    $('.js-status').removeClass('shown');
  }
};
/* Ripple */

function initRipple() {
  if (!document.querySelectorAll) return;
  var rippleHandlers = document.querySelectorAll('.ripple-handler');
  var redraw = function(el) { el.offsetTop + 1; }
  var isTouch = ('ontouchstart' in window);
  for (var i = 0; i < rippleHandlers.length; i++) {
    (function(rippleHandler) {
      function onRippleStart(e) {
        var rippleMask = rippleHandler.querySelector('.ripple-mask');
        if (!rippleMask) return;
        var rect = rippleMask.getBoundingClientRect();
        if (e.type == 'touchstart') {
          var clientX = e.targetTouches[0].clientX;
          var clientY = e.targetTouches[0].clientY;
        } else {
          var clientX = e.clientX;
          var clientY = e.clientY;
        }
        var rippleX = (clientX - rect.left) - rippleMask.offsetWidth / 2;
        var rippleY = (clientY - rect.top) - rippleMask.offsetHeight / 2;
        var ripple = rippleHandler.querySelector('.ripple');
        ripple.style.transition = 'none';
        redraw(ripple);
        ripple.style.transform = 'translate3d(' + rippleX + 'px, ' + rippleY + 'px, 0) scale3d(0.2, 0.2, 1)';
        ripple.style.opacity = 1;
        redraw(ripple);
        ripple.style.transform = 'translate3d(' + rippleX + 'px, ' + rippleY + 'px, 0) scale3d(1, 1, 1)';
        ripple.style.transition = '';

        function onRippleEnd(e) {
          ripple.style.transitionDuration = 'var(--ripple-end-duration, .2s)';
          ripple.style.opacity = 0;
          if (isTouch) {
            document.removeEventListener('touchend', onRippleEnd);
            document.removeEventListener('touchcancel', onRippleEnd);
          } else {
            document.removeEventListener('mouseup', onRippleEnd);
          }
        }
        if (isTouch) {
          document.addEventListener('touchend', onRippleEnd);
          document.addEventListener('touchcancel', onRippleEnd);
        } else {
          document.addEventListener('mouseup', onRippleEnd);
        }
      }
      if (isTouch) {
        rippleHandler.removeEventListener('touchstart', onRippleStart);
        rippleHandler.addEventListener('touchstart', onRippleStart);
      } else {
        rippleHandler.removeEventListener('mousedown', onRippleStart);
        rippleHandler.addEventListener('mousedown', onRippleStart);
      }
    })(rippleHandlers[i]);
  }
}

Cafe.init("\/api", 0, null);