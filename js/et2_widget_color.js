/**
 * eGroupWare eTemplate2 - JS Color picker object
 *
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @package etemplate
 * @subpackage api
 * @link http://www.egroupware.org
 * @author Nathan Gray
 * @copyright Nathan Gray 2012
 * @version $Id$
 */

"use strict";

/*egw:uses
	jquery.jquery;
	et2_core_inputWidget;
	et2_core_valueWidget;
	/phpgwapi/js/jquery/jpicker/jpicker-1.1.6.js;
*/

/**
 * Class which implements the "colorpicker" XET-Tag
 */ 
var et2_color = et2_inputWidget.extend({

	attributes: {
		"alphaSupport": {
			"name": "Transparancy",
			"type": "boolean",
			"default": false,
			"description": "Allow selection of alpha channel as well as color"
		}
	},

	// Settings for jPicker - internal
	defaults: {
		"window": {
			expandable: true,
			effects: {"type":"none"},
			position: { "x": "screenCenter", "y": "screenCenter"}
		},
		"images": {
			clientPath: "phpgwapi/js/jquery/jpicker/images/"
		},
		"color": {
			"active": new jQuery.jPicker.Color()
		}
	},

	init: function() {
		this._super.apply(this, arguments);

		this.egw().includeCSS("phpgwapi/js/jquery/jpicker/css/jPicker-1.1.6.min.css");
		this.input = this.$node = jQuery(document.createElement("span"));

		// Translations
		for(var key in jQuery.fn.jPicker.defaults.localization.text)
		{
			jQuery.fn.jPicker.defaults.localization.text[key] = this.egw().lang(jQuery.fn.jPicker.defaults.localization.text[key]);
		}
		for(var key in jQuery.fn.jPicker.defaults.localization.tooltips)
		{
			jQuery.fn.jPicker.defaults.localization.tooltips[key].ok = this.egw().lang(jQuery.fn.jPicker.defaults.localization.tooltips[key].ok);
			jQuery.fn.jPicker.defaults.localization.tooltips[key].cancel = this.egw().lang(jQuery.fn.jPicker.defaults.localization.tooltips[key].cancel);
		}
		this.options = jQuery.extend({}, this.defaults, this.options);

		this.setDOMNode(this.$node[0]);
	},

	doLoadingFinished: function() {
		this._super.apply(this, arguments);

		var self = this;

		// Initialize jPicker

		this.options.color.active = new jQuery.jPicker.Color({hex:this.value});
		var val = this.$node.jPicker(this.options,
			// Ok
			function(value) {
				self.set_value(value);
				jQuery("table.jPicker").dialog("close");
			},
			// Color change
			null,
			// Cancel
			function(color) {
				jQuery("table.jPicker").dialog("close");
			}
		);

		// Make it look better - plugin defers initialization, so we have to also
		setTimeout(function() {
			// Make the buttons look like all the others
			jQuery("div.jPicker :button").addClass("et2_button et2_button_text");

			// Turn it into a full dialog
			jQuery("table.jPicker").dialog({
				title: self.options.statustext ? self.options.statustext : self.egw().lang('Select color'),
				autoOpen: false,
				resizable: false,
				width: self.get_jPicker() ? self.get_jPicker()[0].width : "auto"
			});

			// Hide original move bar
			jQuery('table.jPicker .Move').hide();	

			// Trigger dialog opening
			jQuery('.Image',self.$node.next()).click(function() {jQuery("table.jPicker").dialog("open")});
		},500);
		return true;
	},

	/**
	 * Get the jPicker object for this widget, so further things can be done to it
	 */
	get_jPicker: function() {
		if(jQuery.jPicker.List.length)
		{
			var self = this;
			return jQuery(jQuery.jPicker.List.filter(function(index, elem) {
				return (this && this.id == self.id);
			}))[0];
		}
		return null;
	},

	getValue: function() {
		return this.value;
	},

	set_value: function(color) {
		if(typeof color == "string") {
			this.value = color;
		}
		else if (typeof color == "object" && color.val)
		{
			// Prefix # to match previous picker values
			this.value = '#'+color.val("hex");
		}

		// Update picker
		if(jQuery.jPicker.List.length)
		{
			var self = this;
			var picker = this.get_jPicker();
			if(picker)
			{
				picker.color.active = new jQuery.jPicker.Color(self.options.value);
			}
		}
	}
});

et2_register_widget(et2_color, ["colorpicker"]);

/**
 * et2_textbox_ro is the dummy readonly implementation of the textbox.
 */
var et2_color_ro = et2_valueWidget.extend([et2_IDetachedDOM], {

	init: function() {
		this._super.apply(this, arguments);

		this.value = "";
		this.$node = $j(document.createElement("div"))
			.addClass("et2_color");

		this.setDOMNode(this.$node[0]);
	},

	set_value: function(_value) {
		this.value = _value;

		if(!_value) _value = "inherit";
		this.$node.css("background-color", _value);
	},
	/**
         * Code for implementing et2_IDetachedDOM
         */
        getDetachedAttributes: function(_attrs)
        {
                _attrs.push("value");
        },

        getDetachedNodes: function()
        {
                return [this.node];
        },

        setDetachedAttributes: function(_nodes, _values)
        {
		this.span = jQuery(_nodes[0]);
		if(typeof _values["value"] != 'undefined')
		{
			this.set_value(_values["value"]);
		}
	}
});

et2_register_widget(et2_color_ro, ["colorpicker_ro"]);
