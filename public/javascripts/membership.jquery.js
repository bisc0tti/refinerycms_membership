
(function($){
  
  
  // redefine slideTo to init slickGrid before sliding
  $.fn.slideTo = function(response) {
    $(this).html(response);
    $("#members").slickGrid();
    $(this).applyMinimumHeightFromChildren();
    $(this).find('.pagination_frame').removeClass('frame_right').addClass('frame_center');
    init_modal_dialogs();
    init_tooltips();
    return $(this);  
  };

  $.fn.slickGrid = function(o){
    
    var Model = function(data){
      this.id_field = 'id';
      this.data = data || [];
    }
    
    Model.prototype.getItem = function(n) {
      return this.data[n];
    }
    
    Model.prototype.getItemIndex = function(id) {
      if(!id) return null; 
      for(var n = 0; n < this.data.length; n++) {
        if(this.data[n][this.id_field] == id) return n;
      }
      return null;
    }
    
    Model.prototype.getLength = function() {
      return this.data.length;
    }
    
    Model.prototype.push = function(d) {
      this.data.push(d);
    }
    
    Model.prototype.updateItemByIndex = function(index, d) {
      this.data[index] = d;
    }    
    
    Model.prototype.updateItem = function(d) {
      var idx = this.getItemIndex(d.id);
      if(idx !== null) {
        this.updateItemByIndex(idx, d);
      }
    }
    
    var table = this[0];
    
    if(!table) return false;
    
    var columns = extractColumns(table);
    var data = extractData(table, columns);
    
    var model = new Model(data);
    
    var opts = {
			enableCellNavigation: true,
      enableColumnReorder: false,
      autoHeight: true,
      forceFitColumns: true,
      rowHeight: 35,
      headerRowHeight: 35
    };
    $(table).wrap('<div></div>');
		var wrapper = $(table).parent();
    $(table).parent().addClass('slick-grid').css({width: $(table).width()});
    var grid = new Slick.Grid($(table).parent().get(0), model, columns, opts);
		$('.pagination_container').applyMinimumHeightFromChildren();
    
    var self = this;
    
    grid.onSort.subscribe(function(){onSort.apply(self, arguments)});
    grid.onColumnsResized.subscribe(function(){onColumnsResize.apply(self, arguments)});
  
    var sort = getSortInfo();

    grid.setSortColumn(columns[sort[0]||0].id, sort[1] == 'asc');
    
    $(table).parent().show();

		$('#menu_container').remove();
		var container = $('<div id="menu_container"></div>').appendTo(document.body).css({width: 0, height: 0});
    init_tooltips();
		initMenus();
    initActions();
		initFilter();
    
    function getModel() {
      return model;
    }
    
    function getGrid() {
      return grid;
    }
    
    function extractColumns(table) {    
      var columns = [];
      var widths = loadColumnsWidths();
      $(table).find('thead th').each(function(idx, th){
        var w = $(th).widthFromClass();
        columns.push({
          name: $(th).html(), 
          field: $(th).attr('data-column-id'), 
          id: $(th).attr('data-column-id'), 
          width: w || widths[idx],
          resizable: w === null,
          sortable: $(th).hasClass('sortable')
        });
      });
      return columns;
    };
    
    function extractData(table, columns) {  
      var data = []
      $(table).find('tbody tr').each(function(idx, tr){
        var row = {};
        row['id'] = $(tr).attr('data-row-id');
        $(tr).find('td').each(function(idx1, td){
          row[columns[idx1].id] = $(td).html();
        });
        data.push(row);
      });
      return data;
    };
    
    function onColumnsResize(ev, grid){
      var columns = grid.grid.getColumns();
      var widths = [];
      for(var n = 0; n < columns.length; n++){
        widths.push(columns[n].width);
      }
      saveColumnsWidths(widths);
    };
    
    function saveColumnsWidths(ary){
      var str = '[' + (ary||[]).join(',') + ']';
      $.cookie('membership_column_widths', str, {expires: 10000, path: '/'});
    };
    
    function loadColumnsWidths(){
      var str = $.cookie('membership_column_widths', {path: '/'}) || '[]';
      return $.parseJSON(str);
    };
    
    function onSort(ev, obj){
      var dir = obj.sortAsc ? 'asc' : 'desc';
      var col = obj.grid.getColumnIndex(obj.sortCol.id);
      var url = updateUrlParams({
				order_by: col, 
				order_dir: dir,
				from_page: '' 
			});
      if(typeof(window.history.pushState) == 'function') {
        var current_state_location = (location.pathname + location.href.split(location.pathname)[1]);
        window.history.pushState({
          path: current_state_location
        }, '', url);
        $('.slick-grid').loading();
        $(document).paginateTo(url);
      } else {
        window.location = url;
      }
    };
    
    function getSortInfo(){
      var params = getUrlParams();
      return [parseInt(params.order_by || 0), (params.order_dir || 'asc').toLowerCase()];
    };
  
    function getUrlParams(){
      var url = window.location.toString();
      var params = {};
      var args = url.split('?')[1];
      if(!args) return {}
      args = args.split('&');
      for(var n = 0; n < args.length; n++){
        var arg = args[n].split('=');
        params[arg[0]] = arg[1];
      }
      return params;
    };

		function getCurrentPage() {
			return $('.pagination').find('em').text();
		}
  
    function updateUrlParams(new_params){
      var url = window.location.toString().replace(/\?.*$/, '');
      var params = getUrlParams();
      new_params = new_params || {};
      var c = 0;
      for(k in new_params){
        c++;
				if(new_params[k] !== null && new_params[k] !== '') {
        	params[k] = new_params[k];
				} else {
					delete(params[k]);
				}
      }
      return c > 0 ? url + '?' + $.param(params) : c;
    };
    
    
    function initActions(){
      $('#menu_container a.action').live('click', onActionClicked);
    };
    
    function onActionClicked(ev){
      ev.preventDefault();
      $('.slick-grid').loading();
      $.ajax($(this).attr('href'), {type: 'PUT'}).complete(function(xhr){
        //$(document).paginateTo(window.location);
        var temp = $('<div></div>').appendTo(document.body).hide().html(xhr.responseText);
        updateGrid(temp.find('table').get(0));
        $('.slick-grid').stopLoading();
        temp.remove();
      });
      return false;
    };
    
    
    function updateGrid(table) {
      if(!table) return false;
      var columns = extractColumns(table); 
      var data = extractData(table, columns); 
      for(var n =0; n < data.length; n++) {
        var idx = model.getItemIndex(data[n].id);
        model.updateItem(data[n]);
        grid.invalidateRow(idx);         
        console.log(idx, data[n])
      }
      grid.render();
      init_tooltips();
			initMenus();
    }

		function initMenus() {
			wrapper.find('span.row_actions span').each(function(e){
				var trigger = $(this).parent().find('> a');
				var triggerCopy = trigger.clone().appendTo(container).addClass('menu_trigger').hide();
				var menu = $(this);
				var id = 'menu_' + Math.random();
				$(this).attr('id', id);
				$(this).appendTo(container).hide();
				trigger.click(function(ev){
					ev.preventDefault();
					if(trigger.hasClass('open')) return;
					var off = trigger.offset();
					var trH = trigger.outerHeight();
					var trW = trigger.outerWidth();
					var mH  = $(menu).outerHeight(true);
					var mW  = $(menu).outerWidth(true);
					var docH = $(window).height(true) + $(window).scrollTop();

					if(off.top + trH + mH > docH) {
						triggerCopy.addClass('menu_on_top');
						menu.css({position: 'absolute', top: off.top - mH, left: off.left - mW + trW}).show();
						triggerCopy.css({position: 'absolute', top: off.top - 1, left: off.left}).show();
					} else {
						triggerCopy.addClass('menu_on_bottom');
						menu.css({position: 'absolute', top: off.top + trH, left: off.left - mW + trW}).show();
					triggerCopy.css({position: 'absolute', top: off.top, left: off.left}).show();
					}
					trigger.addClass('open');

					window.setTimeout(function() {
						$(document.body).one('click', function(){
							trigger.removeClass('open');
							triggerCopy.removeClass('menu_on_bottom');
							triggerCopy.removeClass('menu_on_top');
							menu.hide();	
							triggerCopy.hide();	
						});
					}, 100);
				});
			});
		}

		function initFilter() {
			$('#filter_by').change(function(){
				var filter = $(this).val();

				var curPage = getCurrentPage();
				var url = updateUrlParams({filter_by: filter, page: 1, from_page: curPage > 1 ? curPage : '' });
				if(typeof(window.history.pushState) == 'function') {
					var current_state_location = (location.pathname + location.href.split(location.pathname)[1]);
					window.history.pushState({
						path: current_state_location
					}, '', url);
					$('.slick-grid').loading();
					$(document).paginateTo(url);
				} else {
					window.location = url;
				}

			});
		}
    
    return $(table);
  };
  
  $.fn.widthFromClass = function(){
    var el = this[0];
    if(!el) return null;
    var classes = el.className.split(' ');
    for(var n = 0; n < classes.length; n++){
      var c = classes[n];
      if(/^width_\d\d$/.exec(c)) {
        return parseInt(c.replace('width_', ''));
      }
    }
    return null;
  };
  
  $.fn.loading = function(){
    $(this).find('.slick-header-column:last-child').css({'background-image':  'url(/images/refinery/icons/ajax-loader.gif)', 'background-position': 'right center', 'background-repeat': 'no-repeat'});
  };
  
  $.fn.stopLoading = function(){
    $(this).find('.slick-header-column:last-child').css({'background-image':  ''});
  };


	/*
	 * http://stackoverflow.com/questions/1004475/jquery-css-plugin-that-returns-computed-style-of-element-to-pseudo-clone-that-el
	 */

	/*
	 * getStyleObject Plugin for jQuery JavaScript Library
	 * From: http://upshots.org/?p=112
	 *
	 * Copyright: Unknown, see source link
	 * Plugin version by Dakota Schneider (http://hackthetruth.org)
	 */

	$.fn.getStyleObject = function(){
		var dom = this.get(0);
		var style;
		var returns = {};
		if(window.getComputedStyle){
			var camelize = function(a,b){
				return b.toUpperCase();
			}
			style = window.getComputedStyle(dom, null);
			for(var i=0;i<style.length;i++){
				var prop = style[i];
				var camel = prop.replace(/\-([a-z])/g, camelize);
				var val = style.getPropertyValue(prop);
				returns[camel] = val;
			}
			return returns;
		}
		if(dom.currentStyle){
			style = dom.currentStyle;
			for(var prop in style){
				returns[prop] = style[prop];
			}
			return returns;
		}
		return this.css();
	}
})(jQuery);
