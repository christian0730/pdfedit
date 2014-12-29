var ENDL = process.env.ENDL || "\n"
var dictionaryParser = require('./dictionaryParser.js');
var PDFObject = require('./PDFObject.js')
var Page = require('./Page.js')
var fs = require('fs')
var PDF = function(){
	var self = this;
	self.objects = [];
	self.offsets = [];
	self.pages = [];
	self.trailer = {};
	self.xrefOffsets = [];

	self.debugMode = true;
	self.debugShift = '';
	self.debug = function(){
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

	self.load = function(filename,call){
		call = call || noop
		self.debug('parseFile',filename)
		self.buffer = fs.readFileSync(filename)
		self.parse(self.buffer,call)
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

	self.findObjByField = function(field,value)
	{
		for(var i in self.objects)
		{
			var obj = self.objects[i]
			var md = obj.metadata
			if(md[field])
			{
				if(value)
				{
					if(md[field] == value)
						return md
				}else 
					return md
			}
		}
		return null
	}
	
	self.findObjsByField = function(field,value)
	{
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

	self.save = function(file,call)
	{
		call = call || noop
		var append = self.encode()
		var str = fs.createWriteStream(file)
		str.end(Buffer.concat([self.buffer,new Buffer(append,'UTF-8')]))
		call()
	}

	self.parse = function(buffer,call){
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
			for(var i in self.offsets)
				if(self.offsets[i].status == 'n')
				{
					var b = self.buffer.slice(self.offsets[i].offset)
					var obj = new PDFObject(b)
					if(obj.metadata.Type && obj.metadata.Type.match(/Page$/))
						obj = new Page(null,obj)
					self.objects.push(obj)
				}
			console.log('Finding pages...')
			for(var i in self.objects)
			{
				var obj = self.objects[i]
				var md = obj.metadata
				if(md.Type && md.Type.match(/Pages/))
				{
					console.log('Found pages',md)
					for(var i in md.Kids)
						self.pages.push(self.getObj(md.Kids[i]))
				}
			}
			call(null,true)	
		})
		//call(null,xrefOff)
	}

	self.getObj = function(ref)
	{
		var id = ref.split(' ')[0]
		return self.objects[id]
	}

	self.encode = function()
	{
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
		ret += self.writeXref(ret.length + self.buffer.length)
		return ret;
	}

	self.addPage = function(id){
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

	self.remPage = function(id){
		self.objects[id].enabled = false;
	}

	self.newRef = function(){
		return self.objects.length
	}

	self.addObj = function(obj){
		obj.imported = false
		obj.revision = 0
		obj.id = self.newRef()
		self.objects.push(obj)
	}

	self.parseDict = dictionaryParser.parse

	self.readXref = function(buffer,offset,call){
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
		var xd = self.parseDict(b);
		self.trailer = xd;
		if(xd.Prev)
			self.readXref(buffer,xd.Prev,call)
		else
			call(null,self.offsets)
		return self.offsets
	}

	self.writeXref = function(offset){
		var li = -10;
		var cb = 0;
		var blocks = []
		var ret = '';
		for(var i=0;i<self.offsets.length;i++)
		{
			var last = self.offsets[i-1] || { imported: true }
			var off = self.offsets[i]
			//console.log(i,cb,off.imported,last.imported)
			if(off.imported) continue
			if(last.imported)
			{
				cb = i
				console.log('-',cb)
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
		return ret;
	}

	self.parseDictOld = function(dict,call){
		var ret = {}
		call = call || noop
		ret = readPart(dict.trim()).val
		call(ret);
		return ret;
		var ptrn = /\/([A-Z][a-zA-Z]+)([ \/]*([^\/]+))?/g
		var match;
		while(match = ptrn.exec(dict))
		{
			var k = match[1];
			var v = match[2];
			if(v.match(/<<.+?>>/))
				v = parseDict(v);
		    ret[k] = v;
		}
		call(ret);
		return ret;
	}
}

module.exports = PDF;
function noop(){}