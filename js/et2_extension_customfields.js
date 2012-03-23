/**
 * eGroupWare eTemplate2 - JS Custom fields object
 *
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @package etemplate
 * @subpackage api
 * @link http://www.egroupware.org
 * @author Nathan Gray
 * @copyright Nathan Gray 2011
 * @version $Id$
 */

"use strict";

/*egw:uses
	lib/tooltip;
	jquery.jquery;
	et2_core_xml;
	et2_core_DOMWidget;
	et2_core_inputWidget;
*/

var et2_customfields_list = et2_baseWidget.extend([et2_IDetachedDOM], {

	attributes: {
		'customfields': {
			'name': 'Custom fields',
			'description': 'Auto filled'
		},
		'fields': {
			'name': 'Custom fields',
			'description': 'Auto filled',
			"default": {}
		},
		'value': {
			'name': 'Custom fields',
			'description': 'Auto filled'
		},
		'type_filter': {
			'name': 'Field filter',
			"default": "",
			"type": "string",
			"description": "Filter displayed custom fields by their 'type2' attribute"
		}
	},

	legacyOptions: ["type_filter"],

	prefix: '#',

	init: function() {
		// Some apps (infolog edit) don't give ID, so assign one to get settings
		if(!arguments[1].id) arguments[1].id = "custom_fields";

		this._super.apply(this, arguments);

		// Create the table body and the table
                this.tbody = $j(document.createElement("tbody"));
                this.table = $j(document.createElement("table"))
                        .addClass("et2_grid");
                this.table.append(this.tbody);

		this.rows = {};
		this.widgets = {};
		this.detachedNodes = [];

		if(this.options.type_filter && typeof this.options.type_filter == "string")
		{
			this.options.type_filter = this.options.type_filter.split(",");
		}
		if(this.options.type_filter)
		{
			this.options.fields = {};
			for(var field_name in this.options.customfields)
			{
				if(!this.options.customfields[field_name].type2)
				{
					// No restrictions
					this.options.fields[field_name] = true;
					continue;
				}
				var types = this.options.customfields[field_name].type2.split(",");
				this.options.fields[field_name] = false;
				for(var i = 0; i < types; i++)
				{
					if(jQuery.inArray(types[i],split) > 0)
					{
						this.options.fields[field_name] = true;
						continue;
					}
				}
			}
		}

		this.setDOMNode(this.table[0]);
	},

	destroy: function() {
		this._super.apply(this, arguments);
		this.tbody = null;
		this.table = null;
		this.rows = null;
		this.widgets = null;
	},

	/**
	 * What does this do?  I don't know, but when everything is done the second
	 * time, this makes it work.  Otherwise, all custom fields are lost.
	 */
	assign: function(_obj) {
		this.loadFields();
	},

	getDOMNode: function(_sender) {

		// Check whether the _sender object exists inside the management array
		if(this.rows && _sender.id && this.rows[_sender.id])
		{
			return this.rows[_sender.id];
		}

		return this._super.apply(this, arguments);
	},

	/**
	 * Initialize widgets for custom fields
	 */
	loadFields: function() {
		if(!this.options || !this.options.customfields) return;

		// Already set up - avoid duplicates in nextmatch
		if(this._type == 'customfields-list' && !this.isInTree()) return;
		if(!jQuery.isEmptyObject(this.widgets)) return;

		// Check for global setting changes (visibility)
		var global_data = this.getArrayMgr("modifications").getRoot().getEntry('~custom_fields~');
		if(global_data.fields && !this.options.fields) this.options.fields = global_data.fields;

		// For checking app entries
		var apps = this.egw().link_app_list();

		// Create the table rows
		for(var field_name in this.options.customfields)
		{
			// Skip fields if we're filtering
			if(!jQuery.isEmptyObject(this.options.fields) && !this.options.fields[field_name]) continue;

			var field = this.options.customfields[field_name];

			var id = this.id + "["+this.prefix + field_name+"]";
			// Need curlies around ID for nm row expansion
			if(this.id == '$row')
			{
				id = "{" + this.id + "}" + "["+this.prefix + field_name+"]";
			}

			// Avoid creating field twice
			if(!this.rows[id])
			{

				var row = jQuery(document.createElement("tr"))
					.appendTo(this.tbody);
				var cf = jQuery(document.createElement("td"))
					.appendTo(row);
				var setup_function = '_setup_'+(apps[field.type] ? 'link_entry' : field.type.replace("-","_"));
					
				var attrs = {
					'id': 		id,
					'statustext':	field.help,
					'required':	field.needed,
					'readonly':	this.options.readonly,
					'value':	this.options.value[this.prefix+field_name]
				};
				if(this[setup_function]) {
					var no_skip = this[setup_function].call(this, field_name, field, attrs);
					if(!no_skip) continue;
				}
				
				if(this._type == 'customfields-list') {
					// No label, cust widget
					attrs.readonly = true;
					this.detachedNodes.push(cf[0]);
				} else {
					// Label in first column, widget in 2nd
					cf.text(field.label + "");
					cf = jQuery(document.createElement("td"))
						.appendTo(row);
				}
				this.rows[id] = cf[0];

				// Create widget
				var widget = this.widgets[field_name] = et2_createWidget(attrs.type ? attrs.type : field.type, attrs, this);
			}

			// Field is not to be shown
			if(!this.options.fields || jQuery.isEmptyObject(this.options.fields) || this.options.fields[field_name] == true)
			{
				jQuery(this.rows[field_name]).show();
			} else {
				jQuery(this.rows[field_name]).hide();
			}

		}
	},

	/**
	 * Read needed info on available custom fields from various places it's stored.
	 */
	transformAttributes: function(_attrs) {
		this._super.apply(this, arguments);

		// Add in settings that are objects
		if(!_attrs.customfields)
		{
			// Customized settings for this widget (unlikely)
			var data = this.getArrayMgr("modifications").getEntry(this.id);
			// Check for global settings
			var global_data = this.getArrayMgr("modifications").getRoot().getEntry('~custom_fields~', true);
			if(global_data) data = jQuery.extend({}, data, global_data);
			for(var key in data)
			{
				if(typeof data[key] === 'object' && ! _attrs[key]) _attrs[key] = data[key];
			}
		}

		if (this.id)
		{
			// Set the value for this element
			var contentMgr = this.getArrayMgr("content");
			if (contentMgr != null) {
				var val = contentMgr.getEntry(this.id);
				_attrs["value"] = {};
				if (val !== null)
				{
					// Only set the values that match desired custom fields
					for(var key in val)
					{
						if(key.indexOf(this.prefix) == 0) {
							_attrs["value"][key] = val[key];
						}
					}
					//_attrs["value"] = val;
				}
				else
				{
					// Check for custom fields directly in record
					for(var key in _attrs.customfields)
					{
						_attrs["value"][this.prefix + key] = contentMgr.getEntry(this.prefix + key);
					}
				}
			}
		}
	},
	
	loadFromXML: function(_node) {
		this.loadFields();

		// Load the nodes as usual
                this._super.apply(this, arguments);
	},

	set_value: function(_value) {
		if(!this.options.customfields) return;
		for(var field_name in this.options.customfields)
		{
			// Make sure widget is created, and has the needed function
			if(!this.widgets[field_name] || !this.widgets[field_name].set_value) continue;
			var value = _value[this.prefix + field_name] ? _value[this.prefix + field_name] : null;

			switch(this.options.customfields[field_name].type)
			{
				case 'date':
					// Date custom fields are always in Y-m-d, which seldom matches user's preference
					// which fails when sent to date widget.  This is only used for nm rows, when possible
					// this is fixed server side
					if(value && isNaN(value))
					{
						value = jQuery.datepicker.parseDate("yy-mm-dd",value);
					}
					break;
			}
			this.widgets[field_name].set_value(value);
		}
	},

	/**
	 * Adapt provided attributes to match options for widget
	 */
	_setup_text: function(field_name, field, attrs) {
		// No label on the widget itself
		delete(attrs.label);

		field.type = 'textbox';
		attrs.rows = field.rows;
		attrs.size = field.len;
		return true;
	},
	_setup_select: function(field_name, field, attrs) {
		// No label on the widget itself
		delete(attrs.label);

		attrs.select_options = field.values;
		return true;
	},

	_setup_radio: function(field_name, field, attrs) {
		// No label on the widget itself
		delete(attrs.label);

		field.type = 'radiogroup';
		attrs.options = field.values;
		return true;
	},

	_setup_checkbox: function(field_name, field, attrs) {
	 	// Read-only checkbox is just text
		if(attrs.readonly)
		{
			attrs.ro_true = field.label;
		}
		return true;
	},

	/**
	 * People set button attributes as
	 * label: javascript
	 */
	_setup_button: function(field_name, field, attrs) {
		// No label on the widget itself
		delete(attrs.label);

		attrs.label = field.label;
		for(var key in field.values)
		{
			attrs.label = key;
			attrs.onclick = field.values[key];
		}
		return !attrs.readonly;
	},
	_setup_link_entry: function(field_name, field, attrs) {
		// No label on the widget itself
		delete(attrs.label);

		attrs.type = "link-entry";
		attrs.application = field.type;
		return true;
	},

	/** 
	 * Set which fields are visible, by name
	 *
	 * Note: no # prefix on the name
	 *
	 */
	set_visible: function(_fields) {
		for(var name in _fields)
		{
			if(this.rows[this.prefix + name])
			{
				if(_fields[name])
				{
					jQuery(this.rows[this.prefix+name]).show();
				}
				else
				{
					jQuery(this.rows[this.prefix+name]).hide();
				}
			}
			this.options.fields[name] = _fields[name];
		}
	},

	/**
	 * Code for implementing et2_IDetachedDOM
	 */
	getDetachedAttributes: function(_attrs)
	{
		_attrs.push("value", "class");
	},

	getDetachedNodes: function()
	{
		return this.detachedNodes ? this.detachedNodes : [];
	},

	setDetachedAttributes: function(_nodes, _values)
	{
		// This doesn't need to be implemented.
		// Individual widgets are detected and handled by the grid, but the interface is needed for this to happen
        }
});

et2_register_widget(et2_customfields_list, ["customfields", "customfields-list"]);

