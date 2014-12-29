# PDFEdit
## NodeJS PDF editing

This is a WIP library to edit existing PDFs. 

See app.js for some usage examples.

Note: PDF version MUST be 1.4 or lower. Anything above 1.5 will NOT work.

Install with
	npm install ags131/pdfedit

Usage: (Sorry, this is all the docs at the moment)
	var PDF = require('pdfedit')
	var pdf = new pdf()
	pdf.load('formTest.pdf')
	pdf.fillForm({
		"Address 1 Text Box": "Address 1 New Value",
		"Country Combo Box": "Country New Value",
		"Driving License Check Box":"/Yes"
	})
	pdf.save('formTest_output.pdf')