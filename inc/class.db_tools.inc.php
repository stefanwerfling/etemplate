<?php
	/**************************************************************************\
	* phpGroupWare - eTemplates - DB-Tools                                     *
	* http://www.phpgroupware.org                                              *
	* Written by Ralf Becker <RalfBecker@outdoor-training.de>                  *
	* --------------------------------------------                             *
	*  This program is free software; you can redistribute it and/or modify it *
	*  under the terms of the GNU General Public License as published by the   *
	*  Free Software Foundation; either version 2 of the License, or (at your  *
	*  option) any later version.                                              *
	\**************************************************************************/

	/* $Id$ */

	class db_tools
	{
		var $public_functions = array
		(
			'edit'         => True,
			'needs_save'   => True,
			'writeLangFile'=> True,
			//'admin'       => True,
			//'preferences' => True
		);

		var $debug = 0;
		var $editor;	// editor eTemplate
		var $data;		// Table definitions
		var $app;		// used app
		var $table;		// used table
		var $messages = array(
			'not_found' => 'Not found !!!',
			'select_one' => 'Select one ...',
			'writen' => 'File writen',
			'error_writing' => 'Error: writing file !!!',
			'give_table_name' => 'Please enter table-name first !!!',
			'new_table' => 'New table created'
		);
		var $types = array(
			'auto'		=> 'auto',
			'blob'		=> 'blob',
			'char'		=> 'char',
			'date'		=> 'date',
			'decimal'	=> 'decimal',
			'float'		=> 'float',
			'int'			=> 'int',
			'longtext'	=> 'longtext',
			'text'		=> 'text',
			'timestamp'	=> 'timestamp',
			'varchar'	=> 'varchar'
		);

		/*!
		@function db_tools()
		@abstract constructor of class
		*/
		function db_tools()
		{
			$this->editor = CreateObject('etemplate.etemplate','etemplate.db-tools.edit');
			$this->data = array();

			if (!is_array($GLOBALS['phpgw_info']['apps']) || !count($GLOBALS['phpgw_info']['apps']))
			{
				ExecMethod('phpgwapi.applications.read_installed_apps');
			}
			$this->apps = array();
			reset($GLOBALS['phpgw_info']['apps']);
			while (list($name,$data) = each($GLOBALS['phpgw_info']['apps']))
			{
				$this->apps[$name] = $data['title'];
			}
		}

		/*!
		@function edit()
		@abstract this is the table editor (and the callback/submit-method too)
		*/
		function edit($msg = '')
		{
			if (isset($GLOBALS['HTTP_GET_VARS']['app']))
			{
				$this->app = $GLOBALS['HTTP_GET_VARS']['app'];
			}

			if (isset($GLOBALS['HTTP_POST_VARS']['cont']))
			{
				$content = $GLOBALS['HTTP_POST_VARS']['cont'];
				if ($this->debug)
				{
					echo "HTTP_POST_VARS ="; _debug_array($GLOBALS['HTTP_POST_VARS']);
				}
				$this->app = $content['app'];	// this is what the user selected
				$this->table = $content['table_name'];
				$posted_app = $GLOBALS['HTTP_POST_VARS']['posted_app'];	// this is the old selection
				$posted_table = $GLOBALS['HTTP_POST_VARS']['posted_table'];
			}
			if ($posted_app && $posted_table &&		// user changed app or table
				 ($posted_app != $this->app || $posted_table != $this->table))
			{
				if ($this->needs_save($posted_app,$posted_table,$this->content2table($content)))
				{
					return;
				}
			}
			if (!$this->app)
			{
				$this->table = '';
				$table_names = array('' => lang('none'));
			}
			else
			{
				$this->read($this->app,$this->data);

				for (reset($this->data); list($name,$table) = each($this->data); )
				{
					$table_names[$name] = $name;
				}
			}
			if (!$this->table || $this->app != $posted_app)
			{
				reset($this->data);
				list($this->table) = each($this->data);	// use first table
			}
			elseif ($this->app == $posted_app && $posted_table)
			{
				$this->data[$posted_table] = $this->content2table($content);
			}
			if (isset($content['write_tables']))
			{
				$msg .= $this->messages[$this->write($this->app,$this->data) ?
					'writen' : 'error_writing'];
			}
			elseif (isset($content['delete']))
			{
				list($col) = each($content['delete']);

				reset($this->data[$posted_table]['fd']);
				while ($col-- > 0 && list($key,$data) = each($this->data[$posted_table]['fd']));

				unset($this->data[$posted_table]['fd'][$key]);
			}
			elseif (isset($content['add_column']))
			{
				$this->data[$posted_table]['fd'][''] = array();
			}
			elseif (isset($content['add_table']))
			{
				if (!$content['new_table_name'])
				{
					$msg .= $this->messages['give_table_name'];
				}
				else
				{
					$this->table = $content['new_table_name'];
					$this->data[$this->table] = array('fd' => array(),'pk' =>array(),'ix' => array(),'uc' => array(),'fk' => array());
					$msg .= $this->messages['new_table'];
				}
			}
			elseif ($content['editor'])
			{
				ExecMethod('etemplate.editor.edit');
				return;
			}
			// from here on, filling new content for eTemplate
			$content = array(
				'msg' => $msg,
				'table_name' => $this->table,
				'app' => $this->app,
			);
			if (!isset($table_names[$this->table]))	// table is not jet written
			{
				$table_names[$this->table] = $this->table;
			}

			$sel_options = array(
				'table_name' => $table_names,
				'type' => $this->types,
				'app' => array('' => lang($this->messages['select_one'])) + $this->apps
			);
			if ($this->table != '' && isset($this->data[$this->table]))
			{
				$content += $this->table2content($this->data[$this->table]);
			}
			$no_button = array( );

			if ($this->debug)
			{
				echo 'editor.edit: content ='; _debug_array($content);
			}
			$this->editor->exec('etemplate.db_tools.edit',$content,$sel_options,$no_buttons,
				array('posted_table' => $this->table,'posted_app' => $this->app));
		}

		/*!
		@function needs_save($posted_app,$posted_table,$edited_table)
		@abstract checks if table was changed and if so offers user to save changes
		@param $posted_app the app the table is from
		@param $posted_table the table-name
		@param $edited_table the edited table-definitions
		@returns only if no changes
		*/
		function needs_save($posted_app='',$posted_table='',$edited_table='')
		{
			if (!$posted_app && isset($GLOBALS['HTTP_POST_VARS']['cont']))
			{
				$cont = $GLOBALS['HTTP_POST_VARS']['cont'];
				$preserv = unserialize(stripslashes($GLOBALS['HTTP_POST_VARS']['preserv']));

				if (isset($cont['yes']))
				{
					$this->app   = $preserv['app'];
					$this->table = $preserv['table'];
					$this->read($this->app,$this->data);
					$this->data[$this->table] = $preserv['edited_table'];
					$this->write($this->app,$this->data);
					$msg .= $this->messages[$this->write($this->app,$this->data) ?
						'writen' : 'error_writing'];
				}
				// return to edit with everything set, so the user gets the table he asked for
				$GLOBALS['HTTP_POST_VARS'] = array(
					'cont' => array(
						'app' => $preserv['new_app'],
						'table_name' => $preserv['app']==$preserv['new_app'] ? $preserv['new_table']:''
					),
					'posted_app' => $preserv['new_app'],
				);
				$this->edit($msg);
				return True;
			}
			$new_app   = $this->app;	// these are the ones, the users whiches to change too
			$new_table = $this->table;

			$this->app = $posted_app;
			$this->data = array();
         $this->read($posted_app,$this->data);

			if (isset($this->data[$posted_table]) &&
				 $this->tables_identical($this->data[$posted_table],$edited_table))
			{
				$this->app = $new_app;
				$this->data = array();
				return False;	// continue edit
			}
			$content = array(
				'app' => $posted_app,
				'table' => $posted_table
			);
			$preserv = $content + array(
				'new_app' => $new_app,
				'new_table' => $new_table,
				'edited_table' => $edited_table
			);
			$tmpl = new etemplate('etemplate.db-tools.ask_save');

			$tmpl->exec('etemplate.db_tools.needs_save',$content,array(),array(),
				array('preserv' => $preserv));

			return True;	// dont continue in edit
		}

		/*!
		@function table2content($table)
		@abstract creates content-array from a $table
		@param $table table-definition, eg. $phpgw_baseline[$table_name]
		@returns content-array
		*/
		function table2content($table)
		{
			$content = array();
			for ($n = 1; list($col_name,$col_defs) = each($table['fd']); ++$n)
			{
				$col_defs['name'] = $col_name;
				$col_defs['pk'] = in_array($col_name,$table['pk']);
				$col_defs['uc']  = in_array($col_name,$table['uc']);
				$col_defs['ix'] = in_array($col_name,$table['ix']);
				$col_defs['fk'] = $table['fk'][$col_name];
				if (isset($col_defs['default']) && $col_defs['default'] == '')
				{
					$col_defs['default'] = "''";	// spezial value for empty, but set, default
				}
				$col_defs['n'] = $n;

				$content["Row$n"] = $col_defs;
			}
			if ($this->debug >= 3)
			{
				echo "<p>table2content: content ="; _debug_array($content);
			}
			return $content;
		}

		/*!
		@function content2table($content)
		@abstract creates table-definition from posted content
		@param $content posted content-array
		@returns table-definition
		*/
		function content2table($content)
		{
			$table = array();
			$table['fd'] = array();	// do it in the default order of tables_*
			$table['pk'] = array();
			$table['fk'] = array();
			$table['ix'] = array();
			$table['uc'] = array();
         for (reset($content),$n = 1; isset($content["Row$n"]); ++$n)
			{
				$col = $content["Row$n"];
				if (($name = $col['name']) != '')		// ignoring lines without column-name
				{
					while (list($prop,$val) = each($col))
					{
						switch ($prop)
						{
							case 'default':
							case 'type':	// selectbox ensures type is not empty
							case 'precision':
							case 'nullable':
								if ($val != '' || $prop == 'nullable')
								{
									$table['fd'][$name][$prop] = $prop=='default'&& $val=="''" ? '' : $val;
								}
								break;
							case 'pk':
							case 'uc':
							case 'ix':
								if ($val)
								{
									$table[$prop][] = $name;
								}
								break;
							case 'fk':
								if ($val != '')
								{
									$table['fk'][$name] = $val;
								}
								break;
						}
					}
				}
			}
			if ($this->debug >= 2)
			{
				echo "<p>content2table: table ="; _debug_array($table);
			}
			return $table;
		}

		/*!
		@function read($app,&$phpgw_baseline)
		@abstract includes $app/setup/tables_current.inc.php
		@param $app application name
		@param $phpgw_baseline where to put the data
		@returns True if file found, False else
		*/
		function read($app,&$phpgw_baseline)
		{
			$file = PHPGW_SERVER_ROOT."/$app/setup/tables_current.inc.php";

			$phpgw_baseline = array();

			if ($app != '' && file_exists($file))
			{
				include($file);
			}
			else
			{
				return False;
			}

			if ($this->debug >= 5)
			{
				echo "<p>read($app): file='$file', phpgw_baseline =";
				_debug_array($phpgw_baseline);
			}
			return True;
		}

		function write_array($arr,$depth,$parent='')
		{
			if (in_array($parent,array('pk','fk','ix','uc')))
			{
				$depth = 0;
				if ($parent != 'fk')
				{
					$only_vals = True;
				}
			}
			if ($depth)
			{
				$tabs = "\n";
				for ($n = 0; $n < $depth; ++$n)
				{
					$tabs .= "\t";
				}
				++$depth;
			}
			$def = "array($tabs".($tabs ? "\t" : '');

			reset($arr);
			for ($n = 0; list($key,$val) = each($arr); ++$n)
			{
				if (!$only_vals)
				{
					$def .= "'$key' => ";
				}

				if (is_array($val))
				{
					$def .= $this->write_array($val,$parent == 'fd' ? 0 : $depth,$key,$only_vals);
				}
				else
				{
					if (!$only_vals && $key == 'nullable')
					{
						$def .= $val ? 'True' : 'False';
					}
					else
					{
						$def .= "'$val'";
					}
				}
				if ($n < count($arr)-1)
				{
					$def .= ",$tabs".($tabs ? "\t" : '');
				}
			}
			$def .= "$tabs)";

			return $def;
		}

		/*!
		@function write($app,$phpgw_baseline)
		@abstract writes tabledefinitions $phpgw_baseline to file /$app/setup/tables_current.inc.php
		@param $app app-name
		@param $phpgw_baseline tabledefinitions
		@return True if file writen else False
		*/
		function write($app,$phpgw_baseline)
		{
			$file = PHPGW_SERVER_ROOT."/$app/setup/tables_current.inc.php";

			if (file_exists($file) && ($f = fopen($file,'r')))
			{
				$header = fread($f,filesize($file));
				$header = substr($header,0,strpos($header,'$phpgw_baseline'));
				fclose($f);

				rename($file,PHPGW_SERVER_ROOT."/$app/setup/tables_current.old.inc.php");

				while ($header[strlen($header)-1] == "\t")
				{
					$header = substr($header,0,strlen($header)-1);
				}
			}
			if (!$header)
			{
				$header = "<?php\n\n";
				}

			if (!($f = fopen($file,'w')))
			{
				return False;
			}

			$def .= "\t\$phpgw_baseline = ";
			$def .= $this->write_array($phpgw_baseline,1);
			$def .= ";\n";

			fwrite($f,$header . $def);
			fclose($f);

			return True;
		}

		/*!
		@function normalize($table)
		@abstract sets all nullable properties to True or False
		@returns the new array
		*/
		function normalize($table)
		{
			$all_props = array('type','precision','nullable','default');

			reset($table['fd']);
			while (list($col,$props) = each($table['fd']))
			{
				$table['fd'][$col] = array(
					'type' => ''.$props['type'],
					'precision' => 0+$props['precision'],
					'nullable' => !!$props['nullable'],
					'default' => ''.$props['default']
				);
			}
			return array(
				'fd' => $table['fd'],
				'pk' => $table['pk'],
				'fk' => $table['fk'],
				'ix' => $table['ix'],
				'uc' => $table['uc']
			);
		}

		/*!
		@function tables_identical($old,$new)
		@abstract compares two table-definitions
		@returns True if they are identical or False else
		*/
		function tables_identical($a,$b)
		{
			$a = serialize($this->normalize($a));
			$b = serialize($this->normalize($b));

			//echo "<p>checking if tables identical = ".($a == $b ? 'True' : 'False')."<br>\n";
			//echo "a: $a<br>\nb: $b</p>\n";

			return $a == $b;
		}

		/*!
		@function writeLangFile
		@abstract writes langfile with all templates and messages registered here
		@discussion can be called via http://domain/phpgroupware/index.php?etemplate.db_tools.writeLangFile
		*/
		function writeLangFile()
		{
			$this->tmpl->writeLangFile('etemplate','en',$this->messages);
		}
	}
