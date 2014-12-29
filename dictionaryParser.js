var ENDL = process.env.ENDL || "\n"
function dictionaryParser(){
	var self = this

	self.scanForEnd = function(buffer,offset){
		var arr = { '<':'>','[':']','(':')' }
		return findEnd(buffer,offset,buffer[offset],arr[buffer[offset]])
	}
	self.parse = function(dict,call){
		var ret = {}
		call = call || noop
		//ret = readPart(dict.trim()).val
		//console.log(typeof dict)
		ret = parseDict(dict,0)
		//if(!ret) console.trace(ret,dict.toString())
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
				// /if(typeof val == 'string')// && !val.match(/[\/\[]/))
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
var debugMode = true;
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
	console.log.apply(console,arguments)
}

function parseDict(buffer,offset){
	var off = offset || 0
	var whitespace = [0,9,10,12,13,32] // Null Tab LineFeed FormFeed CarReturn Space
	for(var i in whitespace)
		whitespace[i] = String.fromCharCode(whitespace[i])
	var special = '()<>[]/'
	var collection = { 
		60:['(',')'],
		10:['<','>']
	}
	var starts = [];
	var ends = [];
	for(var i in collection)
	{
		starts.push(collection[i][0])
		  ends.push(collection[i][1])
	}
	var current = []
	var last = '';
	var parts = []
	var stack = 0
	var cont = false
	do{
		var v = buffer[off]
		var c = String.fromCharCode(v)
		if(~special.indexOf(c) 
		|| (~whitespace.indexOf(c) && !~whitespace.indexOf(last)))
		{
			if(current.length)
				parts.push(current)
			if(!~whitespace.indexOf(c))
				parts.push(c)
			current = '';
		}else{
			if(!~whitespace.indexOf(c) || c == ' ')
				current += c
		}
		if(~starts.indexOf(c)) stack++
		if(~ends.indexOf(c))   stack--
		//console.log(off,stack,v,c,!!whitespace[v],current)
		last = c;
		off++
	}while(stack>0)

	var ret = readPart(parts)
	//console.log(ret)
	function rec(part){
		if(part.type == 'dict' || part.type == 'array')
			for(var i in part.value)
				part.value[i] = rec(part.value[i])
		if(part.type == 'name')
			part.value = '/' + part.value
		if(part.type == 'string' && part.hex)
			part.value = '<'+a2hex(part.value)+'>'
		if(part.type == 'string' && !part.hex)
			part.value = '('+part.value+')'
		return part.value;
	}

	ret = rec(ret)

	//console.log('ret',ret)
	return ret;
}

function readPart(parts,offset){
	//console.log(arguments.callee,arguments)
	//console.log('readPart',parts[offset])
	offset = offset || 0
	if(offset)
		parts = parts.slice(offset)
	var ret = null;
	var c = parts[0]
	var n = parts[1]
	if((c+n) != '<<') n = ''
	var funcs = {
		'/': 	readName,
		'<': 	readHexString,
		'<<': 	readDict,
		'(': 	readString,
		'[': 	readArray
	}
	var func = funcs[c+n];
	if(!func)
		func = readRaw
	if(parts[2] == 'R')
		func = readRef
	ret = func(parts)
	return ret;
}

function readRaw(parts,offset)
{
	//console.log(arguments.callee,arguments)
	offset = offset || 0
	return {
		type: 'raw',
		len: 1,
		value: parts[offset]
	}
}

function readRef(parts,offset)
{
	//console.log(arguments.callee,arguments)
	offset = offset || 0
	return {
		type: 'ref',
		len: 3,
		value: [parts[offset],parts[offset+1],parts[offset+2]].join(' ')
	}
}

function readArray(parts,offset)
{
	//console.log(arguments.callee,arguments)
	offset = offset || 0
	if(offset)
		parts = parts.slice(offset)
	var end = findEnd(parts,0,'[',']')
	parts = parts.slice(1,end-1);
	var ret = []
	//console.log(parts,parts.length)
	for(var i=0;i<parts.length;)
	{
		var v = readPart(parts,i)
		i += v.len
		ret.push(v)
	}
	return {
		type: 'array',
		len: end-offset,
		value: ret
	}	
}

function readDict(parts,offset)
{
	//console.log(arguments.callee,arguments)
	offset = offset || 0
	if(offset)
		parts = parts.slice(offset)
	var end = findEnd(parts,0,'<','>')
	parts = parts.slice(2,end-2);
	var ret = {}
	//console.log(parts,parts.length)
	for(var i=0;i<parts.length;)
	{
		var k = readPart(parts,i)
		i += k.len
		var v = readPart(parts,i)
		i += v.len
		ret[k.value] = v;
	}
	return {
		type: 'dict',
		len: end-offset,
		value: ret
	}
}

function readName(parts,offset)
{
	//console.log(arguments.callee,arguments)
	offset = offset || 0
	return {
		type: 'name',
		len: 2,
		value: parts[offset+1]
	}
}

function readHexString(parts,offset)
{
	//console.log(arguments.callee,arguments)
	offset = offset || 0
	var end = findEnd(parts,offset,'<','>')
    var hex = parts.slice(offset+1,end-1).join(' ')
    var str = hex2a(hex)
    return {
		type: 'string',
		len: end-offset,
		value: str,
		hex: true
	}
}

function readString(parts,offset)
{
	//console.log(arguments.callee,arguments)
	offset = offset || 0
	var end = findEnd(parts,offset,'(',')')
	var str = parts.slice(offset+1,end-1).join(' ')
	return {
		type: 'string',
		len: end-offset,
		value: str,
		hex: false
	}
}

function findEnd(coll,offset,start,end){
	//console.log(arguments.callee,arguments)
	offset = offset || 0
	var ind = offset;
	var ret = 0;
	var stack = 0;
	do{
		if(coll[ind] == start) stack++
		if(coll[ind] == end)   stack--
		ind++
	}while(stack && offset < coll.length)
	//console.log('findEnd','ret',offset)
	return ind;
}

function hex2a(hexx) {
    var hex = hexx.toString();//force conversion
    var str = '';
    for (var i = 0; i < hex.length; i += 2)
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    return str;
}

function a2hex(str) {
	var arr = [];
	for (var i = 0, l = str.length; i < l; i ++) {
		var hex = Number(str.charCodeAt(i)).toString(16);
		hex = ('00'+hex).slice(-2)
		arr.push(hex);
	}
	return arr.join('').toUpperCase();
}
function noop(){}
function isRef(str){
	return !!str.match(/^([0-9]+[ ]+[0-9]+[ ]+R)/)
}
module.exports = new dictionaryParser();