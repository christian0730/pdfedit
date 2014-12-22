var ENDL = process.env.ENDL || "\n"
function dictionaryParser(){
	var self = this
	self.parse = function(dict,call){
		var ret = {}
		call = call || noop
		ret = readPart(dict.trim()).val
		call(ret);
		return ret;
	}
	self.encode = function(data){
		var isArray = false;
		var isDict = false
		var isObject = typeof data == 'object'
		var isString = typeof data == 'string'
		isArray = isObject && !!data.length;
		isDict  = isObject && !isArray
		var ret = isArray?[]:''
		if(!isObject && !isString)
		{
			isString = true;
			data = data.toString()
		}
		debugLog('encode','I',data)
		if(isString)
			ret = (data.match(/^[\/\[]/)?'':' ')+data.trim()
		else
			for(var key in data)
			{
				var val = data[key]
				if(isDict)
					ret += '/'+key
				//if(typeof val == 'string')// && !val.match(/[\/\[]/))
				//	val = '@'+val
				//if(typeof val == 'object')
				//console.log('PRE ',val)
				val = self.encode(val)
				//console.log('POST',val)
				if(isArray)
					ret.push(val.trim())
				else
					ret += val
				//console.log(key,val)
			}
		if(isArray) ret = '[' + ret.join(' ') + ']'
		if(isDict) ret = '<<' + ret + '>>'
		debugLog('encode','R',ret)
		return ret;
	}
	self.isRef = isRef
}
var debugMode = !true;
var debugShift = '';
function debugLog(){
	var args = Array.prototype.slice(arguments)
	if(!debugMode) return;
	if(args[0] == '>>>')
		debugShift += "  "
	if(args[0] == '<<<')
		debugShift = debugShift.slice(2)
	args.unshift(debugShift)
	//args[0] = debugShift + args[0]
	console.log.apply(console,args)
}

function readDict(str)
{
	debugLog('>>>')
	var ret = {};
	dict = str.slice(2);//str.replace(/^<<(.+?)/g,'$1')
	//ret.original = dict;
	ret.len = 2;
	while(dict.slice(0,2) != '>>')
	{
		var key = readName(dict)
		dict = dict.slice(key.length)
		//ret.len += key.length

		debugLog(dict.length,dict)
		var value = readPart(dict,ret.len)
		debugLog(dict.length,dict)
		dict = dict.slice(value.len)
		//ret.len += value.len
		debugLog(dict.length,dict,ret.len)

		key = key.slice(1)
		ret[key] = value.val;
	}	
	debugLog('<<<')
	return ret;
}
function readPart(str)
{
	debugLog('>>>')
	var ostr = str;
	str = str.trim()
	var trim = ostr.length - str.length
	debugLog('readPart',str,trim)
	var ret = null
	if(!ret && isRef(str))			 		ret = readRef(str)
	if(!ret && str.match(/^-?[0-9]+/))		ret = readInt(str)
	if(!ret && str.match(/^(true|false)/))	ret = readBool(str)
	if(!ret && str.slice(0,1) == ' ')		ret = readRaw(str)
	if(!ret && str.slice(0,2) == '<<')		ret = readDict(str)
	if(!ret && str.slice(0,1) == '<')		ret = readString(str)
	if(!ret && str.slice(0,1) == '(')		ret = readString(str)
	if(!ret && str.slice(0,1) == '/')		ret = readName(str)
	if(!ret && str.slice(0,1) == '[')		ret = readArray(str)
	ret = ret || str;
	len = ret.len || ret.length
	len += trim
	delete ret.len;
	debugLog('readPart',trim,len,ret)
	debugLog('<<<')
	return { len: len, val: ret }
}
function readArray(str)
{
	debugLog('readArray',str)
	var ret = [];
	//ret.original = str;
	ret.len = 2;
	str = str.slice(1)
	while(str[0] != ']')
	{
		
		var value = readPart(str)
		str = str.slice(value.len)
		ret.push(value.val);
		debugLog('readArray l',value,value.len,ret.len)
		ret.len += value.len
	}	
	debugLog('readArray',ret)
	return ret;
}
function readRef(str){
	debugLog('readRef',str)
	return str.match(/^([0-9]+[ ]+[0-9]+[ ]+R[ ]?)/)[1]
}
function readInt(str){
	debugLog('readInt',str)
	var ret = parseFloat(str).toString();
	return ret;
}
function readBool(str){
	debugLog('readBool',str)
	return str.trim().match(/^(true|false)/i)[1].toLowerCase()
}
function readRaw(str){
	debugLog('readRaw',str)
	return str.trim().match(/^([a-z0-9]+)?/i)[1]
}
function readName(str){
	debugLog('readName',str)
	return str.match(/^(\/[a-z0-9\+\-]+)/i)[1]
}
function readString(str){
	debugLog('readString',str)
	var stack = 0;
	var ind = 0;
	var ret = '';
	do
	{
		var c = str.slice(ind,ind+1)
		ind++
		//debugLog('readString','c',c)
		if(c == '(' || c == '<') stack++
		if(c == ')' || c == '>') stack--
		ret += c
	}while(stack > 0)
	return ret
}

function isRef(str){
	return !!str.match(/^([0-9]+[ ]+[0-9]+[ ]+R)/)
}
function noop(){}
module.exports = new dictionaryParser();