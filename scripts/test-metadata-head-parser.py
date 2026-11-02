import importlib.util, pathlib, unittest, sys
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('head_audit',pathlib.Path(__file__).with_name('audit-metadata-head.py'));audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
class HeadParserTests(unittest.TestCase):
 def test_body_canonical_is_not_a_valid_head_canonical(self):
  r=audit.inspect(b'<html><head><title>T</title></head><body><link rel="canonical" href="https://example.test/a"></body></html>');self.assertFalse(r['tags'][0]['inHead']);self.assertGreater(r['tags'][0]['offset'],r['byteHeadClose'])
 def test_script_and_comment_strings_do_not_create_tags(self):
  b=b'<html><head><script>const s="</head><link rel=canonical href=bad>";</script><!-- <link rel=canonical href=bad> --><title>T</title><link rel="canonical" href="https://example.test/a"></head><body></body></html>';r=audit.inspect(b);self.assertEqual(len(r['tags']),1);self.assertTrue(r['tags'][0]['inHead']);self.assertNotEqual(r['byteHeadClose'],r['naiveByteHeadClose']);self.assertEqual(b[r['byteHeadClose']:r['byteHeadClose']+7],b'</head>')
 def test_duplicate_title_and_canonical_are_reported(self):
  r=audit.inspect(b'<head><title>A</title><title>B</title><link rel="canonical" href="a"><link rel="canonical" href="b"></head>');self.assertEqual(r['duplicateKinds'],{'canonical':2,'title':2})
 def test_inert_template_is_not_effective_metadata(self):
  r=audit.inspect(b'<head><template><link rel="canonical" href="a"></template></head>');self.assertFalse(r['tags'][0]['inHead'])
 def test_offsets_count_original_utf8_bytes(self):
  b='<head><title>één</title>\n<link rel="canonical" href="a"></head>'.encode();r=audit.inspect(b);self.assertEqual(r['tags'][0]['offset'],b.index(b'<link'));self.assertEqual(r['byteHeadClose'],b.index(b'</head>'))
 def test_second_head_in_body_does_not_make_metadata_valid(self):
  r=audit.inspect(b'<head></head><body><head><title>Bad</title></head></body>');self.assertEqual(len(r['headOpen']),2);self.assertFalse(r['title'][0]['inHead'])
if __name__=='__main__':unittest.main()
