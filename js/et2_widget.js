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
	et2_xml;
	et2_common;
	et2_inheritance;
	et2_arrayMgr;
*/

/**
 * The registry contains all XML tag names and the corresponding widget
 * constructor.
 */
var et2_registry = {};

/**
 * Registers the widget class defined by the given constructor and associates it
 * with the types in the _types array.
 */
function et2_register_widget(_constructor, _types)
{
	// Iterate over all given types and register those
	for (var i = 0; i < _types.length; i++)
	{
		var type = _types[i].toLowerCase();

		// Check whether a widget has already been registered for one of the
		// types.
		if (et2_registry[type])
		{
			et2_debug("warn", "Widget class registered for " + type +
				" will be overwritten.");
		}

		et2_registry[type] = _constructor;
	}
}

/**
 * The et2 widget base class.
 */
var et2_widget = Class.extend({

	attributes: {
		"id": {
			"name": "ID",
			"type": "string",
			"description": "Unique identifier of the widget"
		},

		/**
		 * Ignore the "span" property by default - it is read by the grid and
		 * other widgets.
		 */
		"span": {
			"ignore": true
		},

		/**
		 * Ignore the "type" tag - it is read by the "createElementFromNode"
		 * function and passed as second parameter of the widget constructor
		 */
		"type": {
			"ignore": true
		},

		/**
		 * Ignore the readonly tag by default - its also read by the
		 * "createElementFromNode" function.
		 */
		"readonly": {
			"ignore": true
		}
	},

	// Set the legacyOptions array to the names of the properties the "options"
	// attribute defines.
	legacyOptions: [],

	/**
	 * The init function is the constructor of the widget. When deriving new
	 * classes from the widget base class, always call this constructor unless
	 * you know what you're doing.
	 * 
	 * @param _parent is the parent object from the XML tree which contains this
	 * 	object. The default constructor always adds the new instance to the
	 * 	children list of the given parent object. _parent may be NULL.
	 * @param _type is the node name with which the widget has been created. This
	 * 	is usefull if a single widget class implements multiple XET-Node widgets.
	 */
	init: function(_parent, _type, _readonly) {

		if (typeof _type == "undefined")
		{
			_type = "widget";
		}

		this.id = "";
		this._mgrs = {};
		this._inst = null;

		// Copy the parent parameter and add this widget to its parent children
		// list.
		this._parent = _parent;
		this.onSetParent();

		if (_parent != null)
		{
			this._parent.addChild(this);
		}

		this._children = [];
		this.type = _type;
		this.readonly = _readonly;

		// The supported widget classes array defines a whitelist for all widget
		// classes or interfaces child widgets have to support.
		this.supportedWidgetClasses = [et2_widget];
	},

	/**
	 * The destroy function destroys all children of the widget, removes itself
	 * from the parents children list.
	 * In all classes derrived from et2_widget ALWAYS override the destroy
	 * function and remove ALL references to other objects. Also remember to
	 * unbind ANY event this widget created and to remove all DOM-Nodes it
	 * created.
	 */
	destroy: function() {

		// Call the destructor of all children
		for (var i = this._children.length - 1; i >= 0; i--)
		{
			this._children[i].destroy();
		}

		// Remove this element from the parent
		if (this._parent !== null)
		{
			this._parent.removeChild(this);
		}

		// Delete all references to other objects
		this._children = [];
		this._parent = null;
		this._mgrs = {};
		this.onSetParent();
	},

	/**
	 * Creates a copy of this widget. The parameters given are passed to the
	 * constructor of the copied object. If the parameters are omitted, _parent
	 * is defaulted to null
	 */
	clone: function(_parent, _type) {

		// Default _parent to null
		if (typeof _parent == "undefined")
		{
			_parent = null;
		}

		// Create the copy
		var copy = new (this.constructor)(_parent, _type, this.readonly);

		// Assign this element to the copy
		copy.assign(this);

		return copy;
	},

	assign: function(_obj) {
		// Create a clone of all child elements of the given object
		for (var i = 0; i < _obj._children.length; i++)
		{
			_obj._children[i].clone(this, _obj._children[i].type);
		}

		// Copy all properties
		for (var key in  _obj.attributes)
		{
			if (!_obj.attributes[key].ignore)
			{
				this.setAttribute(key, _obj.getAttribute(key));
			}
		}

		// Copy a reference to the content array manager
		this.setArrayMgrs(_obj.mgrs);
	},

	/**
	 * Returns the parent widget of this widget
	 */
	getParent: function() {
		return this._parent;
	},

	/**
	 * The set parent event is called, whenever the parent of the widget is set.
	 * Child classes can overwrite this function. Whe onSetParent is called,
	 * the change of the parent has already taken place.
	 */
	onSetParent: function() {
	},

	/**
	 * Returns the list of children of this widget.
	 */
	getChildren: function() {
		return this._children;
	},

	/**
	 * Returns the base widget
	 */
	getRoot: function() {
		if (this._parent != null)
		{
			return this._parent.getRoot();
		}
		else
		{
			return this;
		}
	},

	/**
	 * Inserts an child at the end of the list.
	 * 
	 * @param _node is the node which should be added. It has to be an instance
	 * 	of et2_widget
	 */
	addChild: function(_node) {
		this.insertChild(_node, this._children.length);
	},

	/**
	 * Inserts a child at the given index.
	 * 
	 * @param _node is the node which should be added. It has to be an instance
	 * 	of et2_widget
	 * @param _idx is the position at which the element should be added.
	 */
	insertChild: function(_node, _idx) {
		// Check whether the node is one of the supported widget classes.
		if (this.isOfSupportedWidgetClass(_node))
		{
			_node.parent = this;
			this._children.splice(_idx, 0, _node);
		}
		else
		{
			throw("_node is not supported by this widget class!");
		}
	},

	/**
	 * Removes the child but does not destroy it.
	 */
	removeChild: function(_node) {
		// Retrieve the child from the child list
		var idx = this._children.indexOf(_node);

		if (idx >= 0)
		{
			// This element is no longer parent of the child
			_node._parent = null;
			_node.onSetParent();

			this._children.splice(idx, 1);
		}
	},

	/**
	 * Searches an element by id in the tree, descending into the child levels.
	 * 
	 * @param _id is the id you're searching for
	 */
	getWidgetById: function(_id) {
		if (this.id == _id)
		{
			return this;
		}

		for (var i = 0; i < this._children.length; i++)
		{
			var elem = this._children[i].getWidgetById(_id);

			if (elem != null)
			{
				return elem;
			}
		}

		return null;
	},

	/**
	 * Function which allows iterating over the complete widget tree.
	 *
	 * @param _callback is the function which should be called for each widget
	 * @param _context is the context in which the function should be executed
	 * @param _type is an optional parameter which specifies a class/interface
	 * 	the elements have to be instanceOf.
	 */
	iterateOver: function(_callback, _context, _type) {
		if (typeof _type == "undefined")
		{
			_type = et2_widget;
		}

		if (this.isInTree() && this.instanceOf(_type))
		{
			_callback.call(_context, this);
		}

		for (var i = 0; i < this._children.length; i++)
		{
			this._children[i].iterateOver(_callback, _context, _type);
		}
	},

	/**
	 * Returns true if the widget currently resides in the visible part of the
	 * widget tree. E.g. Templates which have been cloned are not in the visible
	 * part of the widget tree.
	 * 
	 * @param _vis can be used by widgets overwriting this function - simply
	 * 	write
	 * 		return this._super(inTree);
	 *	when calling this function the _vis parameter does not have to be supplied.
	 */
	isInTree: function(_vis) {
		if (typeof _vis == "undefined")
		{
			_vis = true;
		}

		if (this._parent)
		{
			return _vis && this._parent.isInTree();
		}

		return _vis;
	},

	isOfSupportedWidgetClass: function(_obj)
	{
		for (var i = 0; i < this.supportedWidgetClasses.length; i++)
		{
			if (_obj.instanceOf(this.supportedWidgetClasses[i]))
			{
				return true;
			}
		}
		return false;
	},

	createElementFromNode: function(_node, _nodeName) {

		// Check whether the type attribute exists - if yes pass it instead of
		// the nodeName
		if (_node.getAttribute("type"))
		{
			_nodeName = _node.getAttribute("type");
		}

		if (typeof _nodeName == "undefined")
		{
			_nodeName = _node.nodeName.toLowerCase();
		}

		// Get the constructor for that widget
		var constructor = typeof et2_registry[_nodeName] == "undefined" ?
			et2_placeholder : et2_registry[_nodeName];

		// Check whether the widget is marked as readonly and whether a special
		// readonly type (suffixed with "_ro") is registered
		var readonly = this.getArrayMgr("readonlys").isReadOnly(
			_node.getAttribute("id"), _node.getAttribute("readonly"), this.readonly);
		if (readonly && typeof et2_registry[_nodeName + "_ro"] != "undefined")
		{
			constructor = et2_registry[_nodeName + "_ro"];
		}

		// Creates the new widget, passes this widget as an instance and
		// passes the widgetType. Then it goes on loading the XML for it.
		var widget = new constructor(this, _nodeName, readonly);

		widget.loadFromXML(_node);

		// Call the "loadFinished" function of the widget
		widget.loadingFinished();

		return widget;
	},

	/**
	 * Loads the widget tree from an XML node
	 */
	loadFromXML: function(_node) {
		// Try to load the attributes of the current node
		if (_node.attributes)
		{
			this.loadAttributes(_node.attributes);
		}

		// Load the child nodes.
		for (var i = 0; i < _node.childNodes.length; i++)
		{
			var node = _node.childNodes[i];
			var widgetType = node.nodeName.toLowerCase();

			if (widgetType == "#comment")
			{
				continue;
			}

			if (widgetType == "#text")
			{
				if (node.data.replace(/^\s+|\s+$/g, ''))
				{
					this.loadContent(node.data);
				}
				continue;
			}

			// Create the new element
			this.createElementFromNode(node, widgetType);
		}
	},

	/**
	 * Loads the widget attributes from the passed DOM attributes array.
	 */
	loadAttributes: function(_attrs) {
		for (var i = 0; i < _attrs.length; i++)
		{
			// Special handling for the legacy options
			if (_attrs[i].name == "options")
			{
				// Parse the legacy options
				var splitted = et2_csvSplit(_attrs[i].value);

				for (var i = 0; i < splitted.length && i < this.legacyOptions.length; i++)
				{
					this.setAttribute(this.legacyOptions[i], splitted[i]);
				}
			}
			else
			{
				var attrName = _attrs[i].name;
				var attrValue = _attrs[i].value;

				if (typeof this.attributes[attrName] != "undefined")
				{
					var attr = this.attributes[attrName];

					// If the attribute is marked as boolean, parse the
					// expression as bool expression.
					if (attr.type == "boolean")
					{
						attrValue = this.getArrayMgr("content")
							.parseBoolExpression(attrValue);
					}
					else
					{
						attrValue = this.getArrayMgr("content").expandName(attrValue);
					}
				}

				// Set the attribute
				this.setAttribute(attrName, attrValue);
			}
		}
	},

	/**
	 * Called whenever textNodes are loaded from the XML tree
	 */
	loadContent: function(_content) {
	},

	/**
	 * Called when loading of the widget from XML node is finished. This
	 * function can be used to load the data from the data arrays (content,
	 * readonlys, sel_options etc.)
	 */
	loadingFinished: function() {
	},

	/**
	 * Calls the setter of each property with its current value, calls the
	 * update function of all child nodes.
	 */
	update: function() {

		// Go through every property of this object and check whether a
		// corresponding setter function exists. If yes, it is called.
		for (var key in  this.attributes)
		{
			if (!this.attributes[key].ignore)
			{
				this.setAttribute(key, this.getAttribute(key));
			}
		}

		// Call the update function of all children.
		for (var i = 0; i < this._children.length; i++)
		{
			this._children[i].update();
		}
	},

	/**
	 * Fetches all input element values and returns them in an associative
	 * array. Widgets which introduce namespacing can use the internal _target
	 * parameter to add another layer.
	 */
	getValues: function() {
		var result = {};

		// Iterate over the widget tree
		this.iterateOver(function(_widget) {

			// Get the path to the node we have to store the value at
			var path = _widget.getArrayMgr("content").getPath();

			// Set the _target variable to that node
			var _target = result;
			for (var i = 0; i < path.length; i++)
			{
				// Create a new object for not-existing path nodes
				if (typeof _target[path[i]] == "undefined")
				{
					_target[path[i]] = {};
				}

				// Check whether the path node is really an object
				if (_target[path[i]] instanceof Object)
				{
					_target = _target[path[i]];
				}
				else
				{
					et2_debug("error", "ID collision while writing at path " + 
						"node '" + path[i] + "'");
				}
			}

			// Check whether the entry is really undefined
			if (typeof _target[_widget.id] != "undefined")
			{
				et2_debug("error", _widget, "Overwriting value of '" + _widget.id + 
					"', id exists twice!");
			}

			// Store the value of the widget and reset its dirty flag
			var value = _widget.getValue();
			if (value !== null)
			{
				_target[_widget.id] = value;
			}
			_widget.resetDirty();

		}, this, et2_IInput);

		return result;
	},

	/**
	 * Sets all array manager objects - this function can be used to set the
	 * root array managers of the container object.
	 */
	setArrayMgrs: function(_mgrs) {
		this._mgrs = et2_cloneObject(_mgrs);
	},

	/**
	 * Returns an associative array containing the top-most array managers.
	 *
	 * @param _mgrs is used internally and should not be supplied.
	 */
	getArrayMgrs: function(_mgrs) {
		if (typeof _mgrs == "undefined")
		{
			_mgrs = {};
		}

		// Add all managers of this object to the result, if they have not already
		// been set in the result
		for (var key in this._mgrs)
		{
			if (typeof _mgrs[key] == "undefined")
			{
				_mgrs[key] = this._mgrs[key];
			}
		}

		// Recursively applies this function to the parent widget
		if (this._parent)
		{
			this._parent.getArrayMgrs(_mgrs);
		}

		return _mgrs;
	},

	/**
	 * Sets the array manager for the given part
	 */
	setArrayMgr: function(_part, _mgr) {
		this._mgrs[_part] = _mgr;
	},

	/**
	 * Returns the array manager object for the given part
	 */
	getArrayMgr: function(_part) {
		if (typeof this._mgrs[_part] != "undefined")
		{
			return this._mgrs[_part];
		}
		else if (this._parent)
		{
			return this._parent.getArrayMgr(_part);
		}

		return null;
	},

	/**
	 * Checks whether a namespace exists for this element in the content array.
	 * If yes, an own perspective of the content array is created. If not, the
	 * parent content manager is used.
	 */
	checkCreateNamespace: function() {
		// Get the content manager
		var mgrs = this.getArrayMgrs();

		for (var key in mgrs)
		{
			var mgr = mgrs[key];

			// Get the original content manager if we have already created a
			// perspective for this node
			if (typeof this._mgrs[key] != "undefined" && mgr.perspectiveData.owner == this)
			{
				mgr = mgr.parentMgr;
			}

			// Check whether the manager has a namespace for the id of this object
			if (mgr.getEntry(this.id) instanceof Object)
			{
				// The content manager has an own node for this object, so
				// create an own perspective.
				this._mgrs[key] = mgr.openPerspective(this, this.id);
			}
			else
			{
				// The current content manager does not have an own namespace for
				// this element, so use the content manager of the parent.
				delete(this._mgrs[key]);
			}
		}
	},

	/**
	 * Sets the instance manager object (of type etemplate2, see etemplate2.js)
	 */
	setInstanceManager: function(_inst) {
		this._inst = _inst;
	},

	/**
	 * Returns the instance manager
	 */
	getInstanceManager: function() {
		if (this._inst != null)
		{
			return this._inst;
		}
		else if (this._parent)
		{
			return this._parent.getInstanceManager();
		}

		return null;
	}
});


