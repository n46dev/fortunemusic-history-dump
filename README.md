# fortunemusic-history-dump.js

A dirty script to dump the purchase history from your account on forTune music.

## Prerequisites

* node.js
  - cheerio (https://github.com/cheeriojs/cheerio)
  - request (https://github.com/request/request)

Before executing the script, you need to install the prerequisites as shown below:

```
$ git clone https://github.com/n46dev/fortunemusic-history-dump.git
$ cd fortunemusic-history-dump && npm install
```

## Usage

```
$ ./fortunemusic-history-dump.js
> usage: fortunemusic-history-dump.js [login-id] [login-pw]
```

### Dump

```
$ ./fortunemusic-history-dump.js example@example.org abracadabra
> メンバー    CD            日付 場所 部 当選数 申込数 金額
> 伊藤万理華  13th シングル 2/28 京都 1  8      8      ¥8400
> 伊藤万理華  13th シングル 2/28 京都 5  8      8      ¥8400
> 齋藤飛鳥    13th シングル 2/28 京都 1  16     16     ¥16800
> 齋藤飛鳥    13th シングル 2/28 京都 2  8      8      ¥8400
> ...
```

### Filter

```
$ ./fortunemusic-history-dump.js example@example.org abracadabra | grep '齋藤飛鳥'
> メンバー    CD            日付 場所 部 当選数 申込数 金額
> 齋藤飛鳥    13th シングル 2/28 京都 1  16     16     ¥16800
> 齋藤飛鳥    13th シングル 2/28 京都 2  8      8      ¥8400
> ...
```

## License

_fortunemusic-history-dump.js_ is released under the MIT License.
