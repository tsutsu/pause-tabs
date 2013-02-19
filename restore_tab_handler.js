const OFFSET_FRAGMENT_PATTERN = /#@(\d+)x(\d+)px$/;

var page_offset_match = location.href.match(OFFSET_FRAGMENT_PATTERN);

if(page_offset_match !== null) {
	var page_offset = {x: page_offset_match[1], y: page_offset_match[2]};

	history.replaceState(null, null, location.href.replace(OFFSET_FRAGMENT_PATTERN, ''));

	window.scrollTo(page_offset.x, page_offset.y);
}