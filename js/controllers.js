'use strict';

/* Controllers */

angular.module('myApp.controllers', []).
  controller('LogCtrl', ['$scope', '$rootScope', function ($scope, $rootScope) {
    //------ init ------
    $scope.logs = ['拖入图片'];

    //------ events ------
    // 打印一条日志
    $rootScope.$on('LogCtrl.push', function (ev, doc) {
      $scope.logs.push(doc);
      $scope.$digest();
      var list = document.querySelectorAll('#log > div');
      list[list.length - 1].scrollIntoView();
    });
    // 清空日志
    $rootScope.$on('LogCtrl.clear', function (ev) {
      $scope.logs = [];
      $scope.$digest();
    });
  }]).
  controller('ActionBarCtrl', ['$scope', function ($scope) {
    //------ init ------
    

    //------ events ------
    $scope.selectDirectory = function () {
      document.querySelector('#directory-selector').click();
    };
  
  }]).
  controller('AlertCtrl', ['$scope', '$rootScope', function ($scope, $rootScope) {
    //------ init ------
    $scope.alertMessage = '';

    //------ events ------
    // 弹出提示窗口
    $rootScope.$on('AlertCtrl.alert', function (ev, msg) {
      $scope.alertMessage = msg;
      $scope.$digest();
      document.querySelector('#alert-window').style.top = '0';
    });
    // 关闭提示窗口
    document.querySelector('#alert-window .wrap button').addEventListener('click', function () {
      document.querySelector('#alert-window').style.top = -document.querySelector('#alert-window').offsetHeight -8 + 'px';
    });
  }]).
  controller('MainCtrl', ['$scope', 'Tiger', '$rootScope', function ($scope, Tiger, $rootScope) {
    //------ init ------
    // 当前选择的文件
    $scope.selected = null;
    // 输出模板名称
    $scope.templateName = '';
    // 等待做拼接的文件队列
    $rootScope.pendingFiles = [];

    var gui = require('nw.gui'),
        win = gui.Window.get();
    
    setTimeout(function () {
      win.show();
      // bug fix
      document.body.style.backgroundColor = "black";
      document.body.offsetHeight;
      document.body.style.removeProperty('background-color');
    }, 100);

    //------ functions ------
    $scope.getSep = function () {
      return require('path').sep;
    };
    /*
     * 处理拼接, 要调用需要构造以下参数
     * @param {Function} ev.preventDefault
     * @param {Array} ev.dataTransfer.files
     * @param {Number} ev.dataTransfer.files.length
     */
    function execPuzzle(ev) {
      typeof ev.preventDefault === 'function' && ev.preventDefault();

      $scope.loading = true;

      if (ev.dataTransfer.files.length < 10) {
        $scope.loading = false;
        return $scope.$emit('AlertCtrl.alert', '图片最少10张');
      }

      if (!$scope.selected) {
        $scope.loading = false;
        document.querySelector('#directory-selector').click();
        $scope.pendingFiles = ev.dataTransfer.files;
        return;
      }

      // 读取图片
      // 所有图片读取完成后绘制到canvas中, 并输出到文件
      var tiger = new Tiger(),
          pngs = [];

      // 所有图片文件读取完毕触发
      tiger.on('hungry', function () {

        var MAX_GROUP_ITEMS = 10;
        var width = 0, height = pngs[0].height, singleWidth = pngs[0].width;
        var result = [];
        
        for (var i = 0, length = Math.ceil(pngs.length / MAX_GROUP_ITEMS); i < length; i++) {
          var canvas = document.createElement('canvas'),
              ctx = canvas.getContext('2d');
          
          // 计算拼接图片的宽度
          // 这些拼接图片具有统一的大小
          // 并且最多10个一组
          width = 0;
          for (var j = 0; j < MAX_GROUP_ITEMS * (i + 1); j++) {
            if (!pngs[i * MAX_GROUP_ITEMS + j]) {
              break;
            }
            width += pngs[i * MAX_GROUP_ITEMS + j].width;
          }
          
          canvas.width = width;
          canvas.height = height;

          // 绘制图片
          for (var j = 0; j < MAX_GROUP_ITEMS * (i + 1); j++) {
            if (!pngs[i * MAX_GROUP_ITEMS + j]) {
              break;
            }
            ctx.drawImage(pngs[i * MAX_GROUP_ITEMS + j], j * singleWidth, 0);
          }

          result.push(canvas.toDataURL());
          
          // 缩小一倍
          var cvs = document.createElement('canvas');
          cvs.width = canvas.width / 2;
          cvs.height = canvas.height / 2;
          cvs.getContext('2d').drawImage(canvas, 0, 0, cvs.width, cvs.height);
          result.push(cvs.toDataURL());
        }
        
        var fs = require('fs');
        var path = require('path');
        var templateName = $scope.templateName;
        if(templateName === '') {
          templateName = 'template';
        }

        // 输出文件进度的tiger
        var tiger = new Tiger();
        var spawn = require('child_process').spawn;
        function writeFile(path, buf, i, extra, compress) {
          fs.writeFile(path, buf, function () {
            $scope.$emit('LogCtrl.push', 'done: @' + extra + ' ~ ' + (i / 2 + 1));
            tiger.eat();
            // 压缩为png8
            if (compress === true) {
              var ls = spawn('lib/pngquant', ['--force', '--quality', '80', '--ext', '.8a.png', path]);
              ls.stderr.setEncoding('utf8');
              ls.stderr.on('data', function (data) {
                $scope.$emit('LogCtrl.push', 'error: ' + data);
              });
              // png8 压缩完毕
              ls.on('close', function () {
                console.log(path.substr(0, path.length - 3) + '8a.png');
                $scope.$emit('LogCtrl.push', 'done compress: @' + extra + ' ~ ' + (i / 2 + 1));
                tiger.eat();

                // 转换为base64
                fs.readFile(path.substr(0, path.length - 3) + '8a.png', function (err, data) {
                  if (err) $scope.$emit('LogCtrl.push', 'error: ' + err);

                  // 储存
                  fs.writeFile(path.substr(0, path.length - 3) + '8a.base64', 'data:image/png;base64,' + data.toString('base64'), function () {
                    $scope.$emit('LogCtrl.push', 'done compress base64: @' + extra + ' ~ ' + (i / 2 + 1));
                    tiger.eat();
                  });
                });
              });
            }
          });

          if (compress === true) {
            tiger.feed(2);
          }
        }
        
        // 输出文件
        for (var i = 0, length = result.length; i < length; i+=2) {
          tiger.feed(4);
          var buf = new Buffer(result[i].substr(result[i].indexOf('base64,') + 'base64,'.length), 'base64');
          writeFile(path.join($scope.selected, templateName + '_' + (i / 2 + 1) + '@2x.png'), buf, i, '2x', true);
          writeFile(path.join($scope.selected, templateName + '_' + (i / 2 + 1) + '@2x.base64'), result[i], i, '2x');
          buf = new Buffer(result[i + 1].substr(result[i + 1].indexOf('base64,') + 'base64,'.length), 'base64');
          writeFile(path.join($scope.selected, templateName + '_' + (i / 2 + 1) + '.png'), buf, i, '1x', true);
          writeFile(path.join($scope.selected, templateName + '_' + (i / 2 + 1) + '.base64'), result[i + 1], i, '1x');
        }
        // 文件输出完毕触发
        tiger.on('hungry', function () {
          $scope.$emit('LogCtrl.push', '----------------------------------------');
          $scope.$emit('LogCtrl.push', pngs.length + ' pictures has been done.');
          $scope.loading = false;
          $scope.$digest();

          require('child_process').exec('start ' + $scope.selected);
        });
        tiger.finishFeeding();
      });

      // 把文件读取成图片
      // TODO: 从文件名读取文件
      [].slice.call(ev.dataTransfer.files).forEach(function (val) {
        if (val.type.indexOf('image') !== -1) {
          tiger.feed();
          var img = new Image();
          pngs.push(img);
          if (val.constructor === File) {
            var fr = new FileReader();
            fr.readAsDataURL(val);
            fr.onload = function () {
              img.src = this.result;
              if (img.complete) {
                $scope.$emit('LogCtrl.push', 'loaded: ' + val.path);
                tiger.eat();
              } else {
                img.onload = function () {
                  $scope.$emit('LogCtrl.push', 'loaded: ' + val.path);
                  tiger.eat();
                };
              }
            };
          }
        }
      });

      if (tiger.count < 10) {
        $scope.$emit('AlertCtrl.alert', '图片最少10张');
        return $scope.$emit('LogCtrl.clear');
      }
      $scope.$digest();
      tiger.finishFeeding();
    }

    //------ events ------
    // 输出目录更改
    document.querySelector('#directory-selector').addEventListener('change', function (ev) {
      $scope.output = this.files[0].path;
      $scope.selected = this.files[0].path;
      $scope.$digest();
      if ($scope.pendingFiles && $scope.pendingFiles.length > 0) {
        execPuzzle({
          preventDefault: function () {},
          dataTransfer: {
            files: $scope.pendingFiles
          }
        });
        $scope.pendingFiles = null;
      }
    });
    // 托文件进入窗口
    document.addEventListener('dragover', function (ev) {
      if (ev.dataTransfer.types[0] === 'Files') {
        ev.dataTransfer.effectAllowed = 'all';
        ev.dataTransfer.dropEffect = 'copy';
        ev.preventDefault();
      } else {
        ev.dataTransfer.effectAllowed = 'none';
        ev.dataTransfer.dropEffect = 'none';
      }
    });
    // 文件拖入并释放
    document.addEventListener('drop', execPuzzle);
    // 关闭窗口按钮
    document.querySelector('.window-btn-close').addEventListener('click', function () {
      win.close();
    });

  }]);