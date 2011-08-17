/**
 * eGroupWare eTemplate2 - JS Widget base class
 *
 * @license http://opensource.org/licenses/gpl-license.php GPL - GNU General Public License
 * @package etemplate
 * @subpackage api
 * @link http://www.egroupware.org
 * @author Andreas Stöckel
 * @copyright Stylite 2011
 * @version $Id$
 */

"use strict";

/*egw:uses
	jquery.jquery;
	et2_valueWidget;
*/

/**
 * Interface for all widgets which support returning a value
 */
var et2_IInput = new Interface({
	/**
	 * getValue has to return the value of the input widget
	 */
	getValue: function() {},

	/**
	 * Is dirty returns true if the value of the widget has changed since it
	 * was loaded.
	 */
	isDirty: function() {},

	/**
	 * Causes the dirty flag to be reseted.
	 */
	resetDirty: function() {}
});

/**
 * et2_inputWidget derrives from et2_simpleWidget and implements the IInput
 * interface. When derriving from this class, call setDOMNode with an input
 * DOMNode.
 */
var et2_inputWidget = et2_valueWidget.extend(et2_IInput, {

	attributes: {
		"required": {
			"name":	"Required",
			"default": false,
			"type": "boolean",
			"description": "If required, the user must enter a value before the form can be submitted"
		},
		"label": {
			"name": "Label",
			"default": "",
			"type": "string",
			"description": "The label is displayed by default in front (for radiobuttons behind) each widget (if not empty). If you want to specify a different position, use a '%s' in the label, which gets replaced by the widget itself. Eg. '%s Name' to have the label Name behind a checkbox. The label can contain variables, as descript for name. If the label starts with a '@' it is replaced by the value of the content-array at this index (with the '@'-removed and after expanding the variables)."
		}
	},
	init: function() {
		this._super.apply(this, arguments);

		this._oldValue = "";
	},

	attachToDOM: function() {
		this._super.apply(this,arguments);
		
		$j(this.getInputNode()).attr("novalidate","novalidate"); // Stop browser from getting involved
		$j(this.getInputNode()).validator();
	},
	detatchFromDOM: function() {
		if(this.getInputNode()) {
			$j(this.getInputNode()).data("validator").destroy();
		}
		this._super.apply(this,arguments);
	},

	set_value: function(_value) {
		this._oldValue = _value;

		var node = this.getInputNode();
		if (node)
		{
			$j(node).val(_value);
		}
	},

	set_id: function(_value) {
		this.id = _value;

		// Set the id of the _input_ node (in contrast to the default
		// implementation, which sets the base node)
		var node = this.getInputNode();
		if (node)
		{
			if (_value != "")
			{
				node.setAttribute("id", _value);
				node.setAttribute("name", _value);
			}
			else
			{
				node.removeAttribute("id");
				node.removeAttribute("name");
			}
		}
	},

	set_label: function(_label) {
		if(_label != this.label)
		{
			label = et2_csvSplit(_label, 2, '%s');
			if(label[0]) this.input.before("<span class='et2_label'>"+label[0]+"</span>");
			if(label[1]) this.input.after("<span class='et2_label'>"+label[1]+"</span>");
		}
	},

	set_required: function(_value) {
		var node = this.getInputNode();
		if (node)
		{
			if(_value) {
				$j(node).attr("required", "required");
			} else {
				node.removeAttribute("required");
			}
		}

	},

	get_value: function() {
		return this.getValue();
	},

	getInputNode: function() {
		return this.node;
	},

	getValue: function() {
		var node = this.getInputNode();
		if (node)
		{
			var val = $j(node).val();

			return val;
		}

		return this._oldValue;
	},

	isDirty: function() {
		return this._oldValue != this.getValue();
	},

	resetDirty: function() {
		this._oldValue = this.getValue();
	}

});

