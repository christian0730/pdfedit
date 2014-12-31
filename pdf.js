var ENDL = process.env.ENDL || "\n"
var dictionaryParser = require('./dictionaryParser.js');
var PDFObject = require('./PDFObject.js')
var Page = require('./Page.js')
var fs = require('fs')
var Readable = require('stream').Readable;
var util = require('util');

var PDF = function(){
	PDF.super_.call(this)
	var self = this;
	self.objects = [];
	self.offsets = [];
	self.offset = 0;
	self.pages = [];
	self.trailer = null;
	self.xrefOffsets = [];
	self.pendingCommits = 0

	self.debugMode = true;
	self.debugShift = '';
}
util.inherits(PDF, Readable);

PDF.prototype._read = function(){}

PDF.prototype.debug = function(){
	var self = this
	if(!self.debugMode) return;
	if(arguments[0] == '>>>')
		self.debugShift += "  "
	if(arguments[0] == '<<<')
		self.debugShift = self.debugShift.slice(2)
	for(var i in arguments)
		if(typeof arguments[i] == 'string')
			arguments[i] = arguments[i].slice(0,60)
	arguments[0] = self.debugShift + arguments[0]
	console.log.apply(console,arguments)
}

PDF.prototype.load = function(filename,call){
	var self = this	
	call = call || noop
	self.debug('parseFile',filename)
	self.buffer = fs.readFileSync(filename)
	self.parse(self.buffer,call)
	self.offset = self.buffer.length;
	self.push(self.buffer)
	return;
	var str = fs.createReadStream(filename);
	var bufs = [];
	str.on('data',function(chunk){
		bufs.push(chunk);
	})	
	str.on('end',function(){
		str.close()
		self.buffer = Buffer.concat(bufs);
		self.parse(self.buffer,call)
	})
}

PDF.prototype.findObjByField = function(field,value){
	var self = this
	for(var i in self.objects)
	{
		var obj = self.objects[i]
		var md = obj.metadata
		if(md[field])
		{
			if(value)
			{
				if(md[field] == value)
					return obj
			}else 
				return obj
		}
	}
	return null
}

PDF.prototype.findObjsByField = function(field,value){
	var self = this
	var ret = [];
	for(var i in self.objects)
	{
		var obj = self.objects[i]
		var md = obj.metadata
		if(md[field])
		{
			if(value)
			{
				if(md[field] == value)
					ret.push(obj)
			}else 
				ret.push(obj)
		}
	}
	return ret;
}

PDF.prototype.commit = function(obj,remove){
	var self = this
	self.pendingCommits++
	var remove = !!remove
	obj.revision++
	obj.encode(function(raw){
		var off = self.offsets[obj.id] || {}
		var offset = self.offset;
		var data = {
			offset: 	offset,
			revision: 	(off.revision || -1) + 1,
			status: 	obj.enabled?'n':'f',
			imported:   false
		}
		self.offsets[obj.id] = data;
		self.offset += raw.length
		self.push(raw)
		if(remove)
			delete self.objects[obj.id]
		self.pendingCommits--
	})
}

PDF.prototype.finalize = function(){
	var self = this
	if(self.pendingCommits) return setTimeout(self.finalize.bind(self),100)
	var buf = self.writeXref(self.offset)
	self.push(buf)
	self.push(null)
}

PDF.prototype.save = function(file,call){
	var self = this
	call = call || noop
	var append = self.encode()
	var str = fs.createWriteStream(file)
	str.end(Buffer.concat([self.buffer,new Buffer(append,'UTF-8')]))
	call()
}

PDF.prototype.parse = function(buffer,call){
	var self = this
	self.debug('parse')
	if(buffer.slice(5,8).toString() > 1.4)
		throw 'Version unsupported. VERSION <= 1.4';
	// Find XREF
	var xrefOff = 0;
	var ind = 0;
	while(!xrefOff)
	{
		var s = buffer.slice(ind--).toString()
		if(s.slice(0,9) == 'startxref')
		{
			console.log('XREF found ',ind)
			var p = s.replace(/\r\n?/,"\n").split("\n");
			xrefOff = parseInt(p[1]);
		}
		if(ind < -1024) throw 'xref table not found';
	}
	self.readXref(buffer,xrefOff,function(){
		self.objects.push(new PDFObject()) // Dummy 0 0 obj
		for(var i in self.offsets)
			if(self.offsets[i].status == 'n')
			{
				var b = self.buffer.slice(self.offsets[i].offset)
				var obj = new PDFObject()
				obj.parse(b)
				if(obj.metadata.Type && obj.metadata.Type.match(/Page$/))
					obj = new Page(b)
				if(obj.id != self.objects.length)
					console.trace('Object ID doesnt match!',obj.id,self.objects.length,obj)
				self.objects.push(obj)
			}
		console.log('Finding pages...')
		self.pages = []
		for(var i in self.objects)
		{
			var obj = self.objects[i]
			var md = obj.metadata
			if(md.Type && md.Type.match(/Pages/))
			{
				console.log('Found pages',md)
				for(var i in md.Kids)
				{
					console.log('Page','#'+i,md.Kids[i])
					self.pages.push(self.getObj(md.Kids[i]))
				}
			}
		}
		call(null,true)	
	})
	//call(null,xrefOff)
}

PDF.prototype.getObj = function(ref){
	var self = this
	if(!ref) throw new Exception('Ref invalid')
	var id = ref.split(' ')[0]
	return self.objects[id]
}

PDF.prototype.encode = function(){
	var self = this
	var bufs = [];
	var offset = self.buffer.length;
	var ret = '';
	for(var oi in self.objects)
	{
		var obj = self.objects[oi]
		var off = self.offsets[oi] || {}
		if(obj.imported) continue
		obj.revision++
		var raw = obj.encode()
		var data = {
			offset: 	offset,
			revision: 	(off.revision || -1) + 1,
			status: 	obj.enabled?'n':'f',
			imported:   false
		}
		self.offsets[oi] = data;
		ret += raw;
		offset += raw.length
	}
	//console.log('encode',offset,self.buffer.length,offset-self.buffer.length,ret.length)
	bufs.push(self.writeXref(ret.length + self.buffer.length))
	return Buffer.concat(bufs);
}

PDF.prototype.addPage = function(id){
	var self = this
	var clone = id || null;
	var page = new Page()
	page.id = self.newRef()
	self.objects.push(page)
	page.revision = 0
	var pageIndex = {}
	for(var i in self.objects)
	{
		var obj = self.objects[i]
		var md = obj.metadata
		if(md.Type && md.Type.match(/Pages/))
			pageIndex = obj;
	}
	var md = pageIndex.metadata
	md.Kids.push(page.getRef())
	md.Count = md.Kids.length
	pageIndex.imported = false

	if(clone)
	{
		page.metadata = JSON.parse(JSON.stringify(self.objects[clone].metadata));
		//var md = self.objects[clone].metadata;
		//for(var k in md)
		//	page.metadata[k] = md[k]
	}else
		page.metadata = {
			Contents: 	[],
			CropBox: 	[0,0,612,792],
			MediaBox: 	[0,0,612,792],
			Parent: 	pageIndex.getRef(),
			Resources: 	'',
			Rotate: 	0,
			Type: 		'/Page',
		}
	self.pages.push(page)
	return page
}

PDF.prototype.remPage = function(id){
	var self = this
	self.objects[id].enabled = false;
}

PDF.prototype.newRef = function(){
	var self = this
	return self.objects.length
}

PDF.prototype.addObj = function(obj){
	var self = this
	obj.imported = false
	obj.revision = 0
	obj.id = self.newRef()
	self.objects.push(obj)
}

PDF.prototype.parseDict = dictionaryParser.parse

PDF.prototype.readXref = function(buffer,offset,call){
	var self = this
	call = call || noop
	if(typeof offset == 'string') offset = parseInt(offset)
	self.xrefOffsets.push(offset)
	// Verify that this offset is an xref table
	var b = buffer.slice(offset);
	if(b.slice(0,4).toString() != 'xref')
		throw 'Not an XREF! '+b.slice(0,4).toString()
	b = b.slice(5);
	var line = b.slice(0,20).toString().split("\r\n");
	var p = line[0].split(' ');
	var ind = parseInt(p[0]);
	var len = parseInt(p[1]);
	b = b.slice(line.length+5);
	for(var i=0;i<len;i++)
	{
		var data = {
			offset: 	parseInt(b.slice(0,10).toString()),
			revision: 	parseInt(b.slice(12,16).toString()),
			status: 	b.slice(17,18).toString(),
			imported:   true
		}
		if(!self.offsets[ind] || self.offsets[ind].revision < data.revision)
			self.offsets[ind] = data
		b = b.slice(19)
		if(b.slice(0,1).toString() == "\r" || b.slice(0,1).toString() == "\n") 
			b = b.slice(1)
		ind++
	}
	b = b.slice(8)
	if(b.slice(0,1).toString() == "\r" || b.slice(0,1).toString() == "\n") 
		b = b.slice(1)
	var xd = self.parseDict(b);
	self.trailer = self.trailer || xd;
	if(xd.Prev)
		self.readXref(buffer,xd.Prev,call)
	else
		call(null,self.offsets)
	return self.offsets
}

PDF.prototype.writeXref = function(offset){
	var self = this
	var li = -10;
	var cb = 0;
	var blocks = []
	var ret = '';
	for(var i=0;i<self.offsets.length;i++)
	{
		var last = self.offsets[i-1] || { imported: true }
		var off = self.offsets[i]
		if(!off) console.error('Offset not found!',i,self.offsets.length)
		//console.log(i,cb,off.imported,last.imported)
		if(off.imported) continue
		if(last.imported)
		{
			cb = i
			//console.log('-',cb)
		}
		blocks[cb] = blocks[cb] || []
		blocks[cb].push(off)
	}
	ret += 'xref'+ENDL
	var size = 0
	for(var i in blocks)
	{
		var block = blocks[i]
		ret += i+' '+block.length+ENDL
		for(var ii in block)
		{
			var b = block[ii]
			ret += ('0000000000'+b.offset).slice(-10)+' '+('00000'+b.revision).slice(-5)+' '+b.status+ENDL
			size++
		}
	}
	self.trailer.Size = size
	self.trailer.Prev = self.xrefOffsets[0]
	ret += 'trailer'+ENDL
	ret += dictionaryParser.encode(self.trailer)+ENDL
	ret += 'startxref'+ENDL
	ret += offset+ENDL
	ret += '%%EOF'+ENDL
	return new Buffer(ret,'ascii');
}

PDF.prototype.fillForm = function(obj){
	var self = this
	obj = obj || {}
	var nobj = {}
	for(var i in obj)
	{
		var v = obj[i]
		if(v.slice(0,1) != '/')
			'('+obj[i]+')'
		nobj['('+i+')'] = v
	}
	obj = nobj
	var fields = self.findObjsByField('FT')
	for(var i in fields)
	{
		var field = fields[i]
		var md = field.metadata
		if(obj[md.T])
		{
			md.V = obj[md.T]
			md.DA = md.DA.replace('/ ','/') // Bugfix, this is going to be a tricky fix in the Dictionary Parser
			field.imported = false // Force to be *saved* to PDF
		}
	}
}

module.exports = PDF;
function noop(){}