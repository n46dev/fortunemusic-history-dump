#!/usr/bin/env node --harmony

var path = require('path');
var request = require('request');
var cheerio = require('cheerio');

function report_error_and_exit(contents) {
  console.error(['error:', path.basename(process.argv[1]) + ':', contents].join(' '));
  process.exit(2);
}

function parse_number(expression) {
  if (typeof expression !== 'string') {
    return expression;
  } else {
    return Number(expression.replace(/,/g, '').replace(/\./g, '').replace(/個/g, '').replace(/¥/g, '').replace(/円/g, ''));
  }
}

function normalize_date_string(expression) {
  if (typeof expression !== 'string') {
    return expression;
  } else {
    return expression.replace(/0*(\d{1,2})\/0*(\d{1,2})/g, '$1/$2');
  }
}

function parse_product_name(name) {
  var expression = name.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function(s) { return String.fromCharCode(s.charCodeAt(0) - 0xFEE0) }).replace('　', ' ');
  var match = expression.match(/\s*([^【]+).*?(\d{1,2}\/\d{1,2})\s+(.+?)\s+第(.+?)部.*\D+(\d+?(?:st|nd|rd|th))\s*(シングル|アルバム)/)
  if (match) {
    return {
      person:  match[1],
      date:    normalize_date_string(match[2]),
      venue:   match[3],
      period:  match[4],
      disc:    match[5] + ' ' + match[6]
    };
  }
  return null;
}

function export_as_tsv(details) {
  var data = {};
  details.forEach(function(order) {
    order.products.forEach(function(product) {
      var key = [product.parsed.date, product.parsed.venue, product.parsed.disc, product.parsed.person, product.parsed.period + ' 部'].join(' ');
      if (typeof data[key] === 'undefined') {
        data[key] = {
          accepted_count: 0,
          applied_count: 0,
          total: 0,
          product: undefined
        };
      }
      data[key].accepted_count += product.accepted_count ? product.accepted_count : 0;
      data[key].applied_count  += product.applied_count ? product.applied_count : 0;
      data[key].total          += product.total ? product.total : 0;
      data[key].product         = product;
    });
  });
  var list = [];
  for (var key in data) {
    var e = data[key];
    list.push([e.product.parsed.person, e.product.parsed.disc, e.product.parsed.date, e.product.parsed.venue, e.product.parsed.period, e.accepted_count, e.applied_count, '¥' + e.total]);
  }
  list.sort(function(a, b) {
    var result = Number(b[1].replace(/^(\d+).*$/, '$1')) - Number(a[1].replace(/^(\d+).*$/, '$1'));
    if (result == 0) {
      var months = [Number(a[2].replace(/^(\d+).*$/, '$1')), Number(b[2].replace(/^(\d+).*$/, '$1'))];
      months[0] += (months[0] < 6) ? 12 : 0;
      months[1] += (months[1] < 6) ? 12 : 0;
      result = months[1] - months[0];
    }
    if (result == 0) {
      result = Number(a[2].replace(/^.*(\d+)$/, '$1')) - Number(b[2].replace(/^.*(\d+)$/, '$1'));
    }
    if (result == 0) {
      result = a[0].localeCompare(b[0]);
    }
    if (result == 0) {
      result = Number(a[4]) - Number(b[4]);
    }
    return result;
  });
  list = [['メンバー', 'CD', '日付', '場所', '部', '当選数', '申込数', '金額']].concat(list);
  list = list.map(function(e) { return e.join('\t') });
  return list.join('\n');
}

if (process.argv.length != 4) {
  console.error(['usage:', path.basename(process.argv[1]), '[login-id]', '[login-pw]'].join(' '));
  process.exit(1);
}

var request = request.defaults({jar:request.jar()});

var fortunemusic = {
  login: function(login_id, login_pw) {
    return new Promise(function(resolve, reject) {
      console.error('https://fortunemusic.jp/default/login/' + '...');
      request.post({
        url: 'https://fortunemusic.jp/default/login/',
        form: {
          login_id: login_id,
          login_pw: login_pw
        }
      }, function(error, response, body){
        $ = cheerio.load(body);
        var success = $('.alert-success');
        var error   = $('.alert-error');
        if (success.length > 0) resolve(success.text().trim());
        if (error.length > 0)   reject(error.text().trim());
        reject('An unexpected response returned form the server.');
      });
    });
  },
  apply_list: function() {
    return new Promise(function(resolve, reject) {
      function next_entry(page, entries) {
        console.error('https://fortunemusic.jp/mypage/apply_list/?page=' + page + '...');
        request.get({
          url: 'https://fortunemusic.jp/mypage/apply_list/?page=' + page
        }, function(error, response, body){
          $ = cheerio.load(body);
          var table = $('.table');
          var error = $('.alert-error');
          if (error.length > 0)  { resolve(entries); return; }
          if (table.length == 0) { reject('An unexpected response returned form the server.', false); return }
          var text = {
            urls:        table.find('tbody td:nth-child(1) a').map(function(){ return 'https://fortunemusic.jp' + $(this).attr('href') }).get(),
            identifiers: table.find('tbody td:nth-child(1)').map(function(){ return $(this).text() }).get(),
            dates:       table.find('tbody td:nth-child(2)').map(function(){ return $(this).text() }).get(),
            charges:     table.find('tbody td:nth-child(3)').map(function(){ return $(this).text() }).get(),
            titles:      table.find('tbody td:nth-child(4)').map(function(){ return $(this).text() }).get(),
            statuses:    table.find('tbody td:nth-child(5)').map(function(){ return $(this).text() }).get(),
            results:     table.find('tbody td:nth-child(6)').map(function(){ return $(this).text() }).get()
          };
          for (var i = 0; i < text.urls.length; ++i) {
            entries.push({
              url:        text.urls[i],
              identifier: text.identifiers[i],
              date:       text.dates[i],
              charge:     parse_number(text.charges[i]),
              title:      text.titles[i],
              status:     text.statuses[i],
              result:     text.results[i]
            });
          }
          if (page > 1024) { resolve(entries); return }
          next_entry(page + 1, entries);
        });
      }
      next_entry(0, []);
    });
  },
  apply_details: function(entries) {
    return new Promise(function(resolve, reject) {
      function next_detail(index, details) {
        console.error(entries[index].url + '...');
        request.get({
          url: entries[index].url
        }, function(error, response, body){
          $ = cheerio.load(body);
          var table = $('.table:nth-child(3)');
          var error = $('.alert-error');
          if (error.length > 0)  { resolve(details); return; }
          if (table.length == 0) { reject('An unexpected response returned form the server.', false); return; }
          var text = {
            names:           table.find('tbody:nth-child(1) .span4:nth-child(1)').map(function(){ return $(this).text() }).get(),
            unit_value:      table.find('tbody:nth-child(1) .span2:nth-child(2)').map(function(){ return $(this).text() }).get(),
            applied_counts:  table.find('tbody:nth-child(1) .span2:nth-child(3)').map(function(){ return $(this).text() }).get(),
            accepted_counts: table.find('tbody:nth-child(1) .span2:nth-child(4)').map(function(){ return $(this).text() }).get(),
            total:           table.find('tbody:nth-child(1) .span2:nth-child(5)').map(function(){ return $(this).text() }).get()
          };
          var detail = {
            url:          entries[index].url,
            identifier:   entries[index].identifier,
            date:         entries[index].date,
            charge:       parse_number(entries[index].charge),
            title:        entries[index].title,
            status:       entries[index].status,
            result:       entries[index].result,
            charge:       table.find('tbody:nth-child(1) tr').length > 4 ? parse_number(table.find('tbody:nth-child(1) tr').last().prev().find('td:nth-child(2)').text()) : undefined,
            shipping_fee: table.find('tbody:nth-child(1) tr').length > 4 ? parse_number(table.find('tbody:nth-child(1) tr').last().prev().prev().find('td:nth-child(2)').text()) : undefined,
            price:        table.find('tbody:nth-child(1) tr').length > 4 ? parse_number(table.find('tbody:nth-child(1) tr').last().prev().prev().prev().find('td:nth-child(2)').text()) : undefined,
            products:     []
          };

          for (var i = 0; i < text.names.length; ++i) {
            var parsed = parse_product_name(text.names[i]);

            detail.products.push({
              name:           text.names[i],
              unit_value:     parse_number(text.unit_value[i]),
              applied_count:  parse_number(text.applied_counts[i]),
              accepted_count: parse_number(text.accepted_counts[i]),
              total:          parse_number(text.total[i]),
              parsed:         parsed
            });
          }
          details.push(detail);
          if (index > 1024) { resolve(details); return; }
          if (entries.length === index + 1) { resolve(details); return; }
          next_detail(index + 1, details);
        });
      }
      next_detail(0, []);
    });
  }
};

fortunemusic.login(process.argv[2], process.argv[3]).then(function(message) {
  return fortunemusic.apply_list();
}, function(error) {
  report_error_and_exit(error);
}).then(function(entries) {
  return fortunemusic.apply_details(entries);
}, function(error) {
  report_error_and_exit(error);
}).then(function(details) {
  console.log(export_as_tsv(details));
}, function(error) {
  report_error_and_exit(error);
});
