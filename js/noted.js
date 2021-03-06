/*!
 * noted.js Javascript app
 * http://noted.jongala.com/
 *
 * Copyright (c) 2010, Jonathan Gala - http://jongala.com/
 * jon@jongala.com
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 *
 */

if (!console) {
	var console = {log: function(msg) {}};
}

	
function Noted() {
	
	var self = this;
	this.board = {};
	var default_note_data = {
		name:'Double click to edit Note title',
		color: null,
		width: null,
		height: null,
		items: null
	};

	/* OVERVIEW:
	
	 * Flow goes like this:
	 * init_notes loads a list of note names from note_list, and for each note found, passes the data to build_note
	 * build_note takes note data, clones the (invisible) template note element, 
	   populates it with note data, sets CSS and color stuff, etc.
	 * save_note serializes note data and items, and saves it to localStorage
	
	 */

	var max_done = 15; 
	 
	 /* 
	 * Test for CSS Transforms — adapted from modernizr.js.
	 *
	 * Modernizr is copyright (c) 2009 Faruk Ates - http://farukat.es/
	 * Licensed under the MIT license.
	 * http://modernizr.com/license/
	 *
	 * Featuring major contributions by
	 * Paul Irish  - http://paulirish.com
	 * Ben Alman   - http://benalman.com/
	 *
	 * I don't know if this little snip matters, but here we are.
	 */
	var has_css_transform = 0;
	var transform_properties = ['perspectiveProperty', 'webkitPerspective', 'MozPerspective', 'mozPerspective', 'oPerspective', 'msPerspective'];
	var body_style = $('body')[0].style;
	for (var i in transform_properties) {
		if ( body_style[ transform_properties[i] ] !== undefined ) {
			has_css_transform ++;
		}
	}
	if( has_css_transform ) {$('body').addClass('css_transform');}

/* ========================================================================

	DATA UTILITIES

======================================================================== */

	
	// Shut it down. Shut it down!
	this.nuke = function(){
		// destroy all notes
		$('#board .note').remove();
		this.board = {};
		
		// clear note_list
		delete localStorage.note_list;
		delete localStorage.next_note_id;
		
		console.log('******nuked******');
	};


/* ========================================================================

	INIT NOTES

======================================================================== */

	/* 
	 * Reads note_list, a string of comma-separated note id integers
	 * If notes are found, it loops through them, and for each one passes its data
	 * to build_note();
	 * If no notes are found, it calls create_note.
	 */

	var init_notes = function() {
		
		// GET NOTE INDECES	
		var next_note_id = localStorage.next_note_id;
		var note_list = localStorage.note_list;
		
		if(!note_list || !note_list.length) {

			console.log("==============================\nFirst Launch\n==============================");

			var welcome_timer = setTimeout(function(){$('#welcome_trigger').click();},500);

			self.save_local_data('note_list', '');	// give create_note a base list
			self.save_local_data('next_note_id', 0);	// set first note id number
			self.create_note();	// create a note with default data

		} else { // INITIALIZE NORMALLY
			
			note_list = note_list.split(',');
			
			console.log('init_notes() : found ' + note_list.length + ' notes');
		
			// LOOP THROUGH ALL NOTES
			for (var i=0 ; i < note_list.length ; i++ ) {
				var note_id = note_list[i];
				var note_json = localStorage.getItem(note_id);
				
				if(note_json.length) {
					// ADD NOTE TO DOM
					var note_data = {};
					try {
						note_data = JSON.parse(note_json);
						self.board[note_id] = new Note(note_id, note_data).render();
					} catch(err) {
						show_error('<h3><strong>JSON Parse Error</strong></h3><p>Sorry, an error was encountered when processing your data, and your notes could not be loaded.</p>');
						console.log('init_notes() : JSON PARSE ERROR');
						return;
					}
				}
			}

			// delay the slow sortAndDrag call
			var sort_timer = setTimeout(function(){
				var tstart = new Date().getTime();
				sortAndDrag($('#board .note'));
				var tend = new Date().getTime();
				console.log('sorting took ', (tend - tstart)/1000);
			}, 500);


		}
		
		// run this either way
		self.show_alerts();
		put_ghost_last();
		
	}; // init_notes

/* ========================================================================

	NOTE OPERATIONS

======================================================================== */

	var Note = function(note_id, data) {
		this.id = note_id;
		this.data = {
			name : data.name,
			color : data.color,
			width : data.width,
			height : data.height,
			items : data.items
		};
				
		return this;
	};

	Note.prototype.render = function() {
		var $note = this.$note = $('#note_template').tmpl( $.extend(this.data, {id:this.id}) );

		// replace the existing version of this note, or append to board
		if($('#' + this.id).length) {
			$('#' + this.id).replaceWith($note);
		} else {
			$note.appendTo('#board');	
		}
				
		// SET NOTE SIZE, IF SPECIFIED
		if( this.data.width && this.data.height ) {
			$note.find('.note_content').width( this.data.width ).height( this.data.height );
		}
		
		// SET NOTE COLOR
		$note.find('.note_content, .controls > a.done_trigger, .controls > a.todo_trigger').css('backgroundColor',this.data.color);		// change actual color
		$note.find('.colors .color_input input').val(this.data.color);			// set val in the color selector
		
		// DEFAULT TO "TODO" STATE
		$note.addClass('todo');
		
		// PARSE NOTE ITEMS FROM JSON
		var note_items = (this.data.items && this.data.items.length) ? this.data.items : [];
		// convert from old style item serialization
		if(typeof note_items == 'string') {
			console.log('---String Items; converting');
			// convert to array
			var items_array = [];
			note_items = JSON.parse(note_items);
			for(item in note_items) {
				items_array.push(note_items[item]);
			}
			note_items = items_array;
		}

		$('#item_template').tmpl(note_items).appendTo($note.find('.items'));
		
		return this;			
	};

	Note.prototype.serialize = function() {
		return JSON.stringify(this.data);
	};

	Note.prototype.save = function() {
		console.log('saving ' + this.id);
		self.save_local_data(this.id, this.serialize());
	};

	Note.prototype.save_color = function() {
		this.data.color = this.$note.find('.colors input').val();
		this.save();
	};

	Note.prototype.save_size = function() {
		var $content = this.$note.find('.note_content');
		this.data.width = $content.width();
		this.data.height = $content.height();
		this.save();
	};

	Note.prototype.save_items = function() {
		// BEGIN ITEM SERIALIZATION
		var items = [];
		
		// FIND ITEM ELEMENTS
		this.$note.find('.items li span').each(function(){
			var $item = $(this);
			var item_due = $item.siblings('input.due').val();
			
			// IS ITEM DONE?
			var item_is_done = $item.closest('li').hasClass('done');

			var item_text = $item.text();

			if(item_text.length) { // only save items with text
				items.push({
					text:escapeQuotes(escapeHtmlEntities(item_text)),
					done:item_is_done,
					due:item_due
				});
			}			
		});
		
		this.data.items = items;
		this.save();
	};

	Note.prototype.save_name = function() {
		this.data.name = this.$note.find('.title').text().trim();
		this.save();
	};

	Note.prototype.import_JSON = function(data) {
		this.data = data;
		this.render();
		this.save();
	};

	/* 
	 * Create a new note:
	 * TODO: informative error
	 * This creates a new note, then sets up a dummy note data object with some starting values
	 * It passes the dummy data object to build_note() to actually create the DOM elements for the note
	 */

	this.create_note = function() {
		var new_note_id = localStorage.next_note_id;			// get new note id from increment counter
		var note_list = localStorage.note_list;

		if(!note_list) {
			note_list = [];
		} else {
			note_list = note_list.split(',');
		}

		var note_handle = 'note' + new_note_id;								// note handle will be note node's ID

		note_list.push(note_handle);										// add new note handle to list
		
		self.save_local_data('note_list', note_list.join(','));				// save the updated list
		self.save_local_data('next_note_id', Number(new_note_id) + 1);		// save the updated increment
		self.save_local_data(note_handle, JSON.stringify(default_note_data));	// save the note data	

		self.board[note_handle] = new Note(note_handle, default_note_data).render(); 

		put_ghost_last();												// move ghost
		sortAndDrag($('#' + note_handle));								// resizing and item sorting
		
		return note_handle;		
	};

	
	
	/*
	 * Saves the order of the notes
	 */
	var save_note_order = function() {
		var note_handles = [];
		$('#board li.note').each(function(){
			note_handles.push(this.id);
		});		
		self.save_local_data('note_list',note_handles.join(','));
		put_ghost_last();
	};
	 
	

	/* 
	 * Set an item's "done" status to true
	 * @arg item should be a <li> element
	 */
	var do_item = function(item) {
		var $item = $(item);
		$item.addClass('done');
		self.board[$item.parents('.note').attr('id')].save_items();
	};

	/* 
	 * Delete an item.
	 * @arg item should be a <li> element
	 */
	var delete_item = function(item) {
		var $item = $(item);
		var note_id = $item.parents('.note').attr('id');
		$item.remove();
		self.board[note_id].save_items();
	};
	
	/* 
	 * Confirm deleting a note.
	 * @arg note should be li.note NODE
	 */
	this.confirm_delete_note = function(note) {
		var $note = $(note),
			note_handle = note.id,
			note_title = $note.find('.title span').text(),
			$confirmation_panel = $note.find('.delete_note_confirmation');
				
		$note.find('.overlay').slideUp('fast', function(){
			$note.find('.controls .open').removeClass('open');
		});
		
		if (!$confirmation_panel.length) {
		  $confirmation_panel = $('#delete_note_confirmation_template .delete_note_confirmation').clone();
		  $note.find('.note_content').append( $confirmation_panel );
		}
		$confirmation_panel.slideDown('fast',function(){
			$note.find('.delete_note').addClass('open');
		});
		$note.find('.deleted_note_title').text(note_title);
	};
	
	/* 
	 * Delete a note.
	 * @arg note should be li.note NODE
	 */
	this.delete_note = function(note) {
		var $note = $(note);
		var note_handle = note.id;
		var note_title = $note.find('.title span').text();
		var note_list = localStorage.note_list.split(',');

		console.log('deleting note ' + note_handle);

		$('#' + note_handle).remove();				// delete DOM nodes
		delete localStorage[note_handle];			// delete data

		for(var i =0 ; i<note_list.length ; i++) {	// delete from note list
			if(note_list[i] == note_handle) {
				note_list.splice(i, 1);
			}
		}
		
		self.save_local_data('note_list', note_list.join(','));
	};


	/* 
	 * Export store of all notes as a single JSON object
	 * Members like::  note_handle : note_JSON
	 */
	this.export_all = function() {
		var note_JSON = '';
		var note_list = localStorage.note_list.split(',');
		note_JSON = "{";
		for(var i=0; i<note_list.length ; i++) {
			note_JSON += "\n" + '"' + note_list[i] + '"' + ':' + localStorage[note_list[i]] + ',';
		}
		note_JSON = note_JSON.slice(0,-1); // trim trailing comma
		note_JSON += "\n}";
		return note_JSON;
	};
	
	/* 
	 * Imports a store of all notes, as produced by export_all
	 */
	this.import_all = function(import_JSON) {
		var import_data = {};
		
		try {
			// try parsing the JSON data
			import_data = JSON.parse(import_JSON);
			
			self.nuke();
			var note_list=[];
			var note_handle,note_id = 0;
			
			for(old_handle in import_data) {
				console.log(old_handle);
				//console.log(import_data[old_handle]);
				
				note_handle = "note" + note_id;
				
				self.save_local_data(note_handle,JSON.stringify(import_data[old_handle]));
				
				note_list.push(note_handle);
			
				note_id++;
			}
	
			self.save_local_data('next_note_id',note_list.length);		
			self.save_local_data('note_list',note_list.join(','));
			init_notes();

		} catch(err) {
			show_error('<h3><strong>JSON Parse Error</strong></h3><p>Sorry, an error was encountered when processing your data, and your notes could not be imported.</p>');
			console.log('import_all() : JSON PARSE ERROR');
			return;
		}		
	};

/* ========================================================================

	BEHAVIORS

======================================================================== */
	// useful handles
	var $duedate_pointer = $('#duedate_pointer');
	var duedate_timer;

	/**
	 * Field: save itself when ENTER is pressed 
	 */
	var save_on_enter = function(event){
		var code;
		if (event.keyCode) {
			code = event.keyCode;
		} else if (event.which) {
			code = event.which;
		}
		if(code && code == 13 ) {
			$(event.target).closest('.note_content').find('.add > .trigger').focus();
			save_field(event.target);
		}
	};
	
	/**
	 * Field: save itself when blurred 
	 */
	var save_this_field = function(event){
		save_field(this);
	};
	

	/* SET NOTE INTERACTION BEHAVIORS 
	 * -----------------------------------------------
	 * Make title editable on double click;
	 * Make title edit/input field save itself on change or ENTER keypress;
	 * Have "to-do" and "done" selector links switch the CSS class on the note accordingly (CSS shows and hides content)
	 * Color settings (detailed below)
	 */
	var init_note_meta = function () {
		
		// double click title to get edit field
		$('.note .title span').live('dblclick',function(){
			$(this).hide();
			$(this).after('<input type="text" class="titleText" value="' + $(this).text() + '" />').next('input').focus();
		});
		
		
		// save title field on change
		/* */

		$('.note .title input.titleText').live('blur', save_this_field);
		/* */
		
		// save title field on ENTER keypress
		$('.note .title input.titleText').live('keypress', save_on_enter);
		
		// the todo_trigger activates itself, deactivates the done_trigger sibling, and sets the parent note class
		$('.note .todo_trigger').live('click', function(e){
			e.preventDefault();
			$note = $(this).closest('.note');
			if($note.is('.done')) {
				// switch note state
				$note.removeClass('done flip_done').addClass('todo flip_todo');
				
				// if we have CSS transforms, show/hide the note contents during transition
				if( $('body').hasClass('css_transform') ) {
					$note.find('ul.items, .title, .controls, .add').hide();
					var reveal = setTimeout(function(){$note.find('ul.items, .title, .controls, .add').fadeIn();},500);
				}
			}
		});
		
		$('.note .done_trigger').live('click', function(e){
			e.preventDefault();
			$note = $(this).closest('.note');
			if($note.is('.todo')) {
				// switch note state
				$note.removeClass('todo flip_todo').addClass('done flip_done');
				
				// if we have CSS transforms, show/hide the note contents during transition
				if( $('body').hasClass('css_transform') ) {
					$note.find('ul.items, .title, .controls, .add').hide();
					var reveal = setTimeout(function(){$note.find('ul.items, .title, .controls').fadeIn();},500);
				}
			}
		});
		
		// delete a whole note -- trigger
		$('li.note a.delete_note').live('click', function(e){
			e.preventDefault();
			var $confirm = $(this).closest('.note').find('.delete_note_confirmation');
			if( !$confirm.length || !$confirm.is(':visible') ) {
				self.confirm_delete_note($(this).closest('li.note')[0]);
			} else {
				$confirm.find('.delete_note_dismiss').click();
			}
		});


		/* COLORS
		 * Set triggers to open and close the colors panel
		 * Color is set on the note when the color hex input field is changed;
		 * Shortcut links are color squares, which fill the input field with their hex code, and trigger change event;
		 */ 
		
		// close colors panel with close button
		$('.note .colors a.close').live('click', function(e){
			e.preventDefault();
			$(this).closest('.colors').slideUp('fast',function(){
				$(this).closest('.note').find('.controls a.open').removeClass('open');
			});
		});
		
		// toggle colors panel from color trigger
		$('.note .controls a.color_trigger').live('click', function(e){
			e.preventDefault();
			var $note = $(this).closest('.note');
			var $colorPanel = $note.find('.colors');
			
			$note.find('.overlay:visible:not(.colors)').slideUp('fast',function(){
				$note.find('.controls .open:not(.color_trigger)').removeClass('open');
			});
			
			if($colorPanel.is(':visible')){
				$colorPanel.slideUp("fast");
				$(this).removeClass('open');
			} else {
				$colorPanel.slideDown("fast");
				$(this).addClass('open');
			}
		});

		// Change input hex val to set color
		$('.note .colors input').live('change',function(){
			var colorval = $(this).val();
			$(this).parents('.note').find('.note_content, .controls > a.done_trigger, .controls > a.todo_trigger').css('backgroundColor',colorval)	// set color
			.end().end().parents('.colors').slideUp('fast');								// close the panel
			//save_note_color($(this).parents('.note')[0]);								// save it
			self.board[$(this).parents('.note').attr('id')].save_color();
		});
		
		// click on color squares to set the color input value to the hex code, then trigger change event, which does save
		$('.note .colors > .colorblocks > a').live('click', function(e){
			e.preventDefault();
			var thiscolor = $(this).css('backgroundColor');
			console.log('set color to: ' + getHex(thiscolor) );
			$(this).closest('.colors').find('input').val(getHex(thiscolor)).change();
		});
		
		// little arrow button triggers change event on color field, if they don't press ENTER
		$('.note .colors .color_input a').live('click', function(e){
			e.preventDefault();
			$(this).siblings('input').change();
		});
		
		/* TOOLS
		 * Set triggers to open and close tool menus, 
         * Set menu item interactions w/ modals
		 */ 
		
		// close tools panel with close button
		$('.note .tools a.close').live('click', function(e){
			e.preventDefault();
			$(this).closest('.tools').slideUp('fast',function(){
				$(this).closest('.note').find('.controls a.open').removeClass('open');
			});
		});
		
		// toggle tools panel from color trigger
		$('.note .controls a.tools_trigger').live('click', function(e){
			e.preventDefault();
			var $note = $(this).closest('.note');
			var $toolPanel = $note.find('.tools');
			
			$note.find('.overlay:visible:not(.tools)').slideUp('fast',function(){
				$note.find('.controls .open:not(.tools_trigger)').removeClass('open');
			});
		
			if($toolPanel.is(':visible')){
				$toolPanel.slideUp("fast");		// hide it
				$(this).removeClass('open');
			} else {
				$toolPanel.slideDown("fast");	// show it
				$(this).addClass('open');
			}
		});
		
		// import button
		$('.note .tools a.import_trigger').live('click', function(e){
			e.preventDefault();
			var $note = $(this).closest('.note');
			
			console.log('importing into:' + $note.attr('id'));
			
			$('#importing_note').text($(this).closest('.note').find('.title span').text());
			$('#import_note_handle').val( $note[0].id );
			self.show_modal('#import_field',{
				'callback':function(){
					$('#import_JSON').focus();
				}
			});
			$(this).closest('.tools').find('a.close').click();
		});
		
		$('#import_OK').click(function(){
			import_JSON = $('#import_JSON').val();
			var $note = $('#' + $('#import_note_handle').val());

			if($.trim(import_JSON).length){
				var note_data = {};
				
				try {
					note_data = JSON.parse(import_JSON);
					var note = self.board[$note.attr('id')];
					note.import_JSON(note_data);
				} catch(e) {
					show_error('<h3><strong>JSON Parse Error</strong></h3><p>Sorry, an error was encountered when processing your data, and your note data could not be loaded.</p>');
					console.log('import one note: JSON PARSE ERROR');
					return;
				}
		
			}
			self.clear_modals();
			$note.find('div.tools a.close').click();
		});
		
		$('#import_cancel').click(function(){
			// already cancels modals due to .modal_dismiss class
			var $note = $('#' + $('#import_note_handle').val());
			$note.find('div.tools a.close').click();
		});
		
		// export button
		$('.note .tools a.export_trigger').live('click', function(e){
			e.preventDefault();
			var $note = $(this).closest('.note');
			var note_JSON = self.board[$note.attr('id')].serialize();
			$('#export_note_handle').val( $note[0].id );
			$('#exported_note').text($(this).closest('.note').find('.title span').text());
			$('#export_JSON').val(note_JSON);
			self.show_modal('#export_field',{
				'callback':function(){
					$('#export_JSON').focus();
				}
			});
			$(this).closest('.tools').find('a.close').click();
		});
		
		$('#export_cancel').click(function(e){
			e.preventDefault();
			self.clear_modals();
			var export_note_handle = $('#export_note_handle').val();
			if(export_note_handle.length) {
				$('#' + export_note_handle).find('div.tools a.close').click();
			}
		});
		
		// END TOOLS
		
		// Note interactions
	};


	/*
	 * SET ITEM INTERACTION BEHAVIORS:
	 * -------------------------------------------------------------------
	 * Set bullets to set the item to done when clicked;
	 * Set list items to be editable on double-click;
	 * For item edit/input fields to trigger save_field when they blur or on ENTER keypress;
	 * Set "add" button to create a new item in edit mode and focus the field, when clicked
	 */
	// set item interaction behaviors
	var init_items = function() {
		
		// todo item completion trigger		
		$('.todo .items li .trigger').live('click', function(e){
			e.preventDefault();
			do_item($(this).closest('li'));
			self.show_alerts();
		});
		
		// done item trigger deletes the item
		$('.done .items li .trigger').live('click', function(e){
			e.preventDefault();
			delete_item($(this).closest('li'));
		});
		
		// item due date pointer display
		$('.items li.has_deadline').live('mouseenter',function(){
			clearTimeout(duedate_timer);
			var $item = $(this);
			var $due_field = $(this).find('input.due');

			var off = $(this).offset();
			var itemleft = off.left + $item.width();
			var itemtop = off.top;
			
			var due_date = new Date($due_field.val());
			var due_month = short_months[due_date.getMonth()];
			var due_day = due_date.getDate();
			var due_day_name = short_days[due_date.getDay()] + ",";
			
			$('#duedate_pointer')[0].className = this.className;
		
			if($due_field.val()) {
				$duedate_pointer.find('.day').text(due_day_name).siblings('.month').text(due_month).siblings('.date').text(due_day);
				//$duedate_pointer.css({'left':itemleft,'top':itemtop + 10}).animate({'top':itemtop}).fadeIn();
				$duedate_pointer.css({'left':itemleft,'top':itemtop}).fadeIn('fast');
			}
		})
		.live('mouseleave',function(){
			duedate_timer = setTimeout(function(){
				$duedate_pointer.fadeOut('fast',function(){
					this.className='';
				});
			},200);
		});
		
		// Create and focus a text input when an item is double clicked.
		// Bind save_field() to blur events.  Live binding to keypress follows.
		$('.todo .items li').live('dblclick',function(){
			$item = $(this);
			if( $item.is(':not(.editing)') ) {
				$item.addClass('editing');
				$item.append('<input type="text" class="item" value="' + escapeQuotes(escapeHtmlEntities($(this).text())) + '"/>').find('input.item').focus();
			}
		});
	
		
		// Live binding of save_field on item change
		$('.items input.item').live('blur',save_this_field);
		
		// Live binding of save_field on ENTER keypress
		$('.items input.item').live('keypress',save_on_enter);
		
		// "Add" button creates a new item in entry mode
		$('.note div.add').live('click', function(){
			$items = $(this).siblings('.items');
			$new_item = $('#item_template').tmpl({editing:true}).appendTo($items).find('input.item').focus();
		});
		$('.note div.add > a').live('click', function(e) {e.preventDefault()});
		
		
		// Date trigger
		$('.note .items li a.date_trigger').live('click', function(e){
			e.preventDefault();
			var $trigger = $(this);
			var $note = $trigger.closest('.note');
			var item_date = $trigger.siblings('input.due').val();
			
			var trigger_left = $trigger.offset().left - $note.offset().left;
			var trigger_top = $trigger.offset().top - $note.offset().top;
			$(this).closest('li').addClass('datepicking').closest('.note').find('input.date').val(item_date).css({top:trigger_top,left:trigger_left}).datepicker('show');	
		});
		
		// Date delete trigger
		$('a.date_delete').live('click', function(e){
			e.preventDefault();
			$(this).closest('li').removeClass('has_deadline').find('input.due').val('');
			self.board[$(this).closest('.note').attr('id')].save_items();
			self.show_alerts();
			$('#duedate_pointer').hide();
		});
		
	};
	
	
	/* MAIN CONTROLS
	 * Set behaviors for creating new notes, and forcing SQL queries.
	 */
	init_controls = function() {
		$('a#new_note').click(function(e){
			e.preventDefault();
			self.create_note();
		});
		
		$('#new_note_ghost').live('click', function(){
			$('a#new_note').click();	
		});
		
		
		$('a#nuke').click(function(e){
			e.preventDefault();
			self.nuke();
			window.location.reload();
		});
		
		$('#welcome_trigger').click(function(e){
			e.preventDefault();
			self.show_modal('#welcome',{
				'width':650
			});
		});
		
		$('a#force').click(function(e){
			e.preventDefault();
			var query =  prompt('Enter Query');
			self.force_query(query);
		});
		
		// snap to size
		$('a#snap_to_size').click(function(e){
			e.preventDefault();
			snap_to_size();
		});
		
		// main menu trigger to export whole board
		$('a#export_all').click(function(e){
			e.preventDefault();
			var all_JSON = self.export_all();
			$('#exported_note').text('everything');
			$('#export_JSON').val(all_JSON);
			self.show_modal('#export_field',{
				'callback':function(){
					$('#export_JSON').focus();
				}
			});
		});
		
		// main menu trigger to import whole board
		$('a#import_all').click(function(e){
			self.show_modal('#import_all_field',{
				'callback':function(){
					$('#import_all_JSON').focus();
				}
			});
			e.preventDefault();
		});
		
		// modal button to do whole board import
		$('#import_all_OK').click(function(e){
			e.preventDefault();
			console.log('IMPORTING ALL');
			var import_JSON = $('#import_all_JSON').val();
			
			if($.trim(import_JSON).length){
				self.import_all(import_JSON);				
			}
			
			$('#import_all_JSON').val('');
			self.clear_modals();
		});
		
		// styles menu
		$('.body_styles a').click(function(e){
			e.preventDefault();
			var body_class_name = this.href.slice(this.href.indexOf('#') + 1);
			console.log('body styles: ' + body_class_name);
			$('body')[0].className = body_class_name;
			self.save_local_data('body_class',body_class_name);
		});
		
		$('#alerts_tab').click(function(e){
			e.preventDefault();
			var $content = $('#alerts .alerts_content');
			if($content.is(':hidden')) {
				$content.slideDown();
			} else {
				$content.slideUp();
			}
		});
		
		$('#license_trigger').click(function(e){
			e.preventDefault();
			self.show_modal('#license');
		});
		
		/* delete note stuff */
		
		$('.delete_note_confirmation .delete_note_dismiss').live('click', function(e){
			e.preventDefault();
			$(this).closest('.delete_note_confirmation').slideUp('fast',function(){
				$(this).closest('.note').find('.delete_note').removeClass('open');
				$(this).remove();
			});
		});
		
		$('.delete_note_confirmation .delete_note_OK').live('click', function(e){
			e.preventDefault();
			self.delete_note( $(this).closest('.note')[0] );
		});
		
	};

	// LOADS GENERAL APP PREFS LIKE BODY STYLES, DISPLAY PREFS, ETC.
	load_defaults = function(){
		var body_class = localStorage.getItem('body_class');
		if(!body_class) {
			body_class = 'slate';
		}

		$('body').addClass(body_class);
	};
	
	
	/* KEYBOARD COMMANDS
	 * 
	 */
	 
	$('html').keyup(function(e){
		var code;
		if (e.keyCode) {
			code = e.keyCode;
		} else if (e.which) {
			code = e.which;
		}
		switch(e.which) {
			// F1
			case 112: $('#alerts_tab').click();
				break;
				
			// ESC
			case 27: 
				self.cancelAllEdits();
				self.clear_modals();
				break;
		}
	});
	
	/* MODAL INTERACTIONS
	 * 
	 */
	 

	this.show_modal = function(modal_selector,options) {
		var defaults = {
			'width':500,
			'height':400,
			'callback':function(){}
		};

		options = $.extend({},defaults,options);
		
		$(modal_selector).css({
			'margin-left':-options.width/2,
			'margin-top':-options.height/2
		}).find('.content').css({
			'width':options.width,
			'height':options.height
		});
		
		$( modal_selector + ', #modal_screen').fadeIn('fast',options.callback);
	};

	this.clear_modals = function() {
		return $('.modal, #modal_screen').fadeOut('fast');
	};
	
	var show_error = function(error_message,options) {
		var defaults = {
			'width':300,
			'height':200,
			'callback':function(){}
		};
		
		options = $.extend({},defaults,options);
		
		$('#error_message').html($(error_message));
		$('.modal').hide();

		$('#error').css({
			'margin-left':-options.width/2,
			'margin-top':-options.height/2
		}).find('.content').css({
			'width':options.width,
			'height':options.height
		});

		// delay showing errors slightly, to allow other modals to clear first
		var error_timer = setTimeout(function(){
			$('#error, #modal_screen').show();
		},300);
	};
	
	$('.modal_dismiss').live('click', function(e){
		e.preventDefault();
		$(this).closest('div.modal').find('textarea, input').val('');
		self.clear_modals();
	});
	
	$('#modal_screen').click(function(e){
		e.preventDefault();
		self.clear_modals();
	});

/* ========================================================================

	UTILITIES

======================================================================== */

	// accepts input node as argument
	var save_field = function(input_node) {
		var $input = $(input_node);
		var item_id = input_node.id;
		var item_text = $input.val().trim();
		var note;

		console.log('save_field(): saving: "' + item_text + '"');
		
		// IF WE HAVE TEXT,
		// update and show span, remove input, save note.
		if(item_text.length) {
			note = self.board[ $input.parents('.note').attr('id') ];
			$input.closest('li').removeClass('editing');
			$input.siblings('span').text(item_text).show().end().hide();
			
			if($input.hasClass('titleText')) {
				note.save_name();
			} else if ($input.hasClass('item')) {
				note.save_items();	
			}

			$input.remove();
		
		
		// IF FIELD WAS BLANKED, BUT SPAN HAS TEXT,
		// show span, remove input
		} else if($input.siblings('span').text().length) {
			console.log('blank field, span has text');
				$input.siblings('span').show().end().remove();
		
		// IF IT IS A NEW FIELD THAT IS BLANK,
		// remove the whole item
		} else {
			$input.closest('li').remove();
		}
	};
	
	
	this.save_local_data = function(key,val) {
		try {
			localStorage.setItem(key,val);
		} catch(e) {
			console.log('**** DATA SAVE ERROR ******');
			show_error('<h3><strong>Data Save Error</strong></h3><p>Your data was not saved.  Please make sure that you are not browsing in Icognito/Private Browsing mode, and reload Noted.</p>');
		}
	};

	this.cancelAllEdits = function() {
		//$('.items li.editing').removeClass('editing').find('span').show().end().find('input.item').remove();
		$('.items li.editing').each(function(){
			var $item = $(this);
			if( !($.trim($item.find('span').text()).length || $.trim($item.find('input.item').val()).length) ) {
				$item.remove();
			} else {
				$item.removeClass('editing').find('span').show().end().find('input.item').remove();
			}
		});
		$('li.note div.title').find('input').remove().end().find('span').show();
	};
	
	var snap_to_size = function() {
		$('#board li.note').each(function(){
			$(this).find('.note_content').css({width:250,height:240});
			//save_note_size(this);
			self.board[this.id].save_size();
		});
	};

	var escapeQuotes = function(text) {
		return text.replace(/"/g,'&quot;');
	};

	/* 
	 * Javascript entity escape functions from Stackoverflow http://stackoverflow.com/questions/1354064/how-to-convert-characters-to-html-entities-using-plain-javascript/1354715#1354715
	 */
	var escapeHtmlEntities = function(text) {
		return text.replace(/[\u00A0-\u2666<>\&]/g, function(c) { 
			var s = escapeHtmlEntities.entityTable[c.charCodeAt(0)] || '#'+c.charCodeAt(0);
			return '&' + s + ';'; 
		});
	};
	
	// all HTML4 entities as defined here: http://www.w3.org/TR/html4/sgml/entities.html
	// added: amp, lt, gt, quot and apos
	escapeHtmlEntities.entityTable = { 34 : 'quot', 38 : 'amp', 39 : 'apos', 60 : 'lt', 62 : 'gt', 160 : 'nbsp', 161 : 'iexcl', 162 : 'cent', 163 : 'pound', 164 : 'curren', 165 : 'yen', 166 : 'brvbar', 167 : 'sect', 168 : 'uml', 169 : 'copy', 170 : 'ordf', 171 : 'laquo', 172 : 'not', 173 : 'shy', 174 : 'reg', 175 : 'macr', 176 : 'deg', 177 : 'plusmn', 178 : 'sup2', 179 : 'sup3', 180 : 'acute', 181 : 'micro', 182 : 'para', 183 : 'middot', 184 : 'cedil', 185 : 'sup1', 186 : 'ordm', 187 : 'raquo', 188 : 'frac14', 189 : 'frac12', 190 : 'frac34', 191 : 'iquest', 192 : 'Agrave', 193 : 'Aacute', 194 : 'Acirc', 195 : 'Atilde', 196 : 'Auml', 197 : 'Aring', 198 : 'AElig', 199 : 'Ccedil', 200 : 'Egrave', 201 : 'Eacute', 202 : 'Ecirc', 203 : 'Euml', 204 : 'Igrave', 205 : 'Iacute', 206 : 'Icirc', 207 : 'Iuml', 208 : 'ETH', 209 : 'Ntilde', 210 : 'Ograve', 211 : 'Oacute', 212 : 'Ocirc', 213 : 'Otilde', 214 : 'Ouml', 215 : 'times', 216 : 'Oslash', 217 : 'Ugrave', 218 : 'Uacute', 219 : 'Ucirc', 220 : 'Uuml', 221 : 'Yacute', 222 : 'THORN', 223 : 'szlig', 224 : 'agrave', 225 : 'aacute', 226 : 'acirc', 227 : 'atilde', 228 : 'auml', 229 : 'aring', 230 : 'aelig', 231 : 'ccedil', 232 : 'egrave', 233 : 'eacute', 234 : 'ecirc', 235 : 'euml', 236 : 'igrave', 237 : 'iacute', 238 : 'icirc', 239 : 'iuml', 240 : 'eth', 241 : 'ntilde', 242 : 'ograve', 243 : 'oacute', 244 : 'ocirc', 245 : 'otilde', 246 : 'ouml', 247 : 'divide', 248 : 'oslash', 249 : 'ugrave', 250 : 'uacute', 251 : 'ucirc', 252 : 'uuml', 253 : 'yacute', 254 : 'thorn', 255 : 'yuml', 402 : 'fnof', 913 : 'Alpha', 914 : 'Beta', 915 : 'Gamma', 916 : 'Delta', 917 : 'Epsilon', 918 : 'Zeta', 919 : 'Eta', 920 : 'Theta', 921 : 'Iota', 922 : 'Kappa', 923 : 'Lambda', 924 : 'Mu', 925 : 'Nu', 926 : 'Xi', 927 : 'Omicron', 928 : 'Pi', 929 : 'Rho', 931 : 'Sigma', 932 : 'Tau', 933 : 'Upsilon', 934 : 'Phi', 935 : 'Chi', 936 : 'Psi', 937 : 'Omega', 945 : 'alpha', 946 : 'beta', 947 : 'gamma', 948 : 'delta', 949 : 'epsilon', 950 : 'zeta', 951 : 'eta', 952 : 'theta', 953 : 'iota', 954 : 'kappa', 955 : 'lambda', 956 : 'mu', 957 : 'nu', 958 : 'xi', 959 : 'omicron', 960 : 'pi', 961 : 'rho', 962 : 'sigmaf', 963 : 'sigma', 964 : 'tau', 965 : 'upsilon', 966 : 'phi', 967 : 'chi', 968 : 'psi', 969 : 'omega', 977 : 'thetasym', 978 : 'upsih', 982 : 'piv', 8226 : 'bull', 8230 : 'hellip', 8242 : 'prime', 8243 : 'Prime', 8254 : 'oline', 8260 : 'frasl', 8472 : 'weierp', 8465 : 'image', 8476 : 'real', 8482 : 'trade', 8501 : 'alefsym', 8592 : 'larr', 8593 : 'uarr', 8594 : 'rarr', 8595 : 'darr', 8596 : 'harr', 8629 : 'crarr', 8656 : 'lArr', 8657 : 'uArr', 8658 : 'rArr', 8659 : 'dArr', 8660 : 'hArr', 8704 : 'forall', 8706 : 'part', 8707 : 'exist', 8709 : 'empty', 8711 : 'nabla', 8712 : 'isin', 8713 : 'notin', 8715 : 'ni', 8719 : 'prod', 8721 : 'sum', 8722 : 'minus', 8727 : 'lowast', 8730 : 'radic', 8733 : 'prop', 8734 : 'infin', 8736 : 'ang', 8743 : 'and', 8744 : 'or', 8745 : 'cap', 8746 : 'cup', 8747 : 'int', 8756 : 'there4', 8764 : 'sim', 8773 : 'cong', 8776 : 'asymp', 8800 : 'ne', 8801 : 'equiv', 8804 : 'le', 8805 : 'ge', 8834 : 'sub', 8835 : 'sup', 8836 : 'nsub', 8838 : 'sube', 8839 : 'supe', 8853 : 'oplus', 8855 : 'otimes', 8869 : 'perp', 8901 : 'sdot', 8968 : 'lceil', 8969 : 'rceil', 8970 : 'lfloor', 8971 : 'rfloor', 9001 : 'lang', 9002 : 'rang', 9674 : 'loz', 9824 : 'spades', 9827 : 'clubs', 9829 : 'hearts', 9830 : 'diams', 338 : 'OElig', 339 : 'oelig', 352 : 'Scaron', 353 : 'scaron', 376 : 'Yuml', 710 : 'circ', 732 : 'tilde', 8194 : 'ensp', 8195 : 'emsp', 8201 : 'thinsp', 8204 : 'zwnj', 8205 : 'zwj', 8206 : 'lrm', 8207 : 'rlm', 8211 : 'ndash', 8212 : 'mdash', 8216 : 'lsquo', 8217 : 'rsquo', 8218 : 'sbquo', 8220 : 'ldquo', 8221 : 'rdquo', 8222 : 'bdquo', 8224 : 'dagger', 8225 : 'Dagger', 8240 : 'permil', 8249 : 'lsaquo', 8250 : 'rsaquo', 8364 : 'euro' };


	// Color Conversion functions based on work from highlightFade
	// By Blair Mitchelmore
	// http://jquery.offput.ca/highlightFade/
	// ... modified to output hex by Jonathan Gala : http://jongala.com/

	// Parse strings looking for color tuples [255,255,255]
	var getHex = function(color) {
		var result;

		// Look for rgb(num,num,num)
		if (result = /rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)/.exec(color))
			return '#' + parseInt(result[1]).toString(16) + parseInt(result[2]).toString(16) + parseInt(result[3]).toString(16);

		// Look for rgb(num%,num%,num%)
		if (result = /rgb\(\s*([0-9]+(?:\.[0-9]+)?)\%\s*,\s*([0-9]+(?:\.[0-9]+)?)\%\s*,\s*([0-9]+(?:\.[0-9]+)?)\%\s*\)/.exec(color))
			return '#' + parseInt(parseFloat(result[1])*2.55).toString(16) + parseInt(parseFloat(result[2])*2.55).toString(16) + parseInt(parseFloat(result[3])*2.55).toString(16);

		// Look for #a0b1c2
		if (result = /#([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})/.exec(color))
			return '#' + result[1] + result[2] + result[3];

		// Look for #fff
		if (result = /#([a-fA-F0-9])([a-fA-F0-9])([a-fA-F0-9])/.exec(color))
			return '#' + result[1] + result[2] + result[3];

		// Otherwise, we're most likely dealing with a named color
		return colors[jQuery.trim(color).toLowerCase()];
	};
	
	
	var short_months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	
	var short_days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
	
	var truncate_string = function(fullstring, limit) {
		limit = limit || 15;
		if(fullstring.length < limit) {
			return fullstring;
		} else {
			return fullstring.slice(0,limit-1) + '…';
		}
	};
	
	var put_ghost_last = function() {
		$ghost = $('#new_note_ghost');
		if( $('#board li:last') != $ghost ) {
			$ghost.remove();
			$('#board').append($ghost);
		}
	};

/* ========================================================================

	SORTING AND DRAGGING

======================================================================== */


	/*
	 * Set up sort and drag on a note
	 * @arg $note is a jQuery note collection
	 */
	var sortAndDrag = function($note){

		// Make notes resizable
		// save when done
		$note.find('.note_content').resizable(
			{
				handles: 'e, se',
				stop: function(event,ui) {
					if ( (ui.originalSize.width !== ui.size.width) || (ui.originalSize.height !== ui.size.height) ) {
						self.board[$(this).closest('.note').attr('id')].save_size();
					}
				}
			}
		);
	
		// make item lists sortable
		// enable dragging between notes
		$note.find('.items').sortable(
			{
				distance:3,
				update:function(event,ui) {
					list = $(ui.item).closest('.note')[0];
					self.board[list.id].save_items();
					if (ui.sender) {
						oldlist = $(ui.sender).closest('.note')[0];
						self.board[oldlist.id].save_items();
					}
				},
				start:function(event,ui) {
					$(ui.item).closest('.note').addClass('top');
				},
				stop:function(event,ui) {
					$(ui.item).closest('.note').removeClass('top');
				},
				connectWith: '.items'
			}
		);
		
		$note.find('input.date').datepicker({
			onClose:function(dateText,inst){
				$picking_item = $('.datepicking');
				$note = $picking_item.closest('.note');
				
				if(dateText.length) {
					$picking_item.find('input.due').val(dateText).end().addClass('has_deadline');
					self.board[ $note.attr('id') ].save_items();
					self.show_alerts();
				} else {
					console.log('no date selected');
				}
				
				$picking_item.removeClass('datepicking');
			}
		});
				
	};

/* ========================================================================

	CALENDAR

======================================================================== */
	
	this.renderCalendar = function() {
	
	};

/* ========================================================================

	ALERTS

======================================================================== */

	this.show_alerts = function() {
		
		// count the number of pressing items we have going in; if it has increased, we will open the alerts panel
		var old_pressing = $('#alerts .due .alert, #alerts .overdue .alert').length;
		var new_pressing = 0;
		
		$('#alerts .alert').remove();						// blank the alert containers
		$('.items .due_today').removeClass('due_today');		// remove item classes
		$('.items .overdue').removeClass('overdue');
	
		var now = new Date();
		/* 
		var due_month = short_months[due_date.getMonth()];
			var due_day = due_date.getDate();
		*/
		
		var nowDisplay = short_months[now.getMonth()] + "." + now.getDate();
		$('#todayDisplay').text(nowDisplay);
		
		var today = Date.parse((now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear());
		var auto_open = false;
		
		
		
		$('li.note').each(function(){
			var note_title = truncate_string($(this).find('.title').text());
			
			$('.items li:not(.done)',this).each(function(){		// loop through all items
				var $item = $(this);
				var due = $item.find('input.due').val();
				if(due) {
					$alert = $('#alert_template').tmpl()
							.click(function(){
								$item.find('a.trigger').click();
							}).hover(function(){
								$item.addClass('hilite');
								$item.mouseover();
							},function(){
								$item.removeClass('hilite');
								$item.mouseout();
							});
					$alert.html('<strong>' + note_title + '</strong>: ' + $(this).find('span').text());
					
					var duedate = Date.parse(due);
					var lead = Math.floor((duedate - today)/86400000);	// lead time in days

					if ( lead === 0 ) {
						$('#alerts .due').append($alert);
						$item.addClass('due_today');
						new_pressing++;
					} else if ( lead < 0) {
						$alert.append($("<span> (+" + (-lead) + " days)</span>"));
						$('#alerts .overdue').append($alert);
						$item.addClass('overdue');
						new_pressing++;
					} else if ( lead <= 7 ) {  //   one week lead
						$('#alerts .coming').append($alert);
					}
					
				}
			});
			
		});
		
		if( new_pressing > old_pressing ) {		// slide down panel if we have new urgent items, or if this is initialization
			$('#alerts .alerts_content').slideDown();
		}
	};

/* ========================================================================

	RUN INITIALIZATIONS

======================================================================== */

	// TEST FOR LOCAL STORAGE, RUN INITS IF IT'S THERE
	if( typeof window.localStorage == 'object')	{
		
		init_notes();						// read notes, create HMTL
		init_items();						// init item behaviors
		init_note_meta();					// init note behaviors
		init_controls();					// init main noted options
		load_defaults();					// load page defaults
		
		// make board sortable
		$('#board').sortable({
			distance:10,
			start:function(event,ui){
				$(ui.item).closest('.note').addClass('sorting');
			},
			stop:function(event,ui){
				$(ui.item).closest('.note').removeClass('sorting');
			},
			update:function(event,ui){
				save_note_order();
			}
		});
		
	} else { // OTHERWISE SHOW ERROR
		
		$('#masthead, #alerts, #new_note_ghost').hide();
		var storage_error = "<h1>Error: No Data Storage</h1>"
		+ "<p>Your browser does not support local data storage.  Please upgrade to:</p>"
		+ "<ul>"
		+ "<li><a href='http://www.apple.com/safari/'>Apple Safari 4+</a></li>"
		+ "<li><a href='http://www.getfirefox.com/'>Mozilla Firefox 3.5+</a></li>"
		+ "<li><a href='http://www.google.com/chrome/'>Google Chrome</a></li>"
		+ "</ul>";
		$('#board').append($(storage_error));
		
	}
}
