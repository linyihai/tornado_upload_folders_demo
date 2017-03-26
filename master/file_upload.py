#!/usr/bin/python
# -*- coding: utf-8 -*-

import os
import re
import stat
import threading
import traceback
from db_fileupload import UploadFileData
from log import Logger
from globalvar import UPLOAD_PATH
from globalvar import IS_WINDOWS


logger = Logger('file_upload')

class SizeLimitError(Exception):
    pass


class FileUpload:

    """Parse a stream of multpart/form-data.

    Useful for request handlers decorated with tornado.web.stream_request_body"""
    SEP = b"\r\n"
    LSEP = len(SEP)
    PAT_HEADERVALUE = re.compile(r"""([^:]+):\s+([^\s;]+)(.*)""")
    PAT_HEADERPARAMS = re.compile(r""";\s*([^=]+)=\"(.*?)\"(.*)""")

    # Encoding for the header values. Only header name and parameters
    # will be decoded. Streamed data will remain binary.
    # This is required because multipart/form-data headers cannot
    # be parsed without a valid encoding.
    header_encoding = "UTF-8"

    def __init__(self, total, tmpdir=None):
        self.buf = b""
        self.dlen = None
        self.delimiter = None
        self.in_data = False
        self.headers = []
        self.parts = []
        self.total = total
        self.received = 0
        self.tmpdir = tmpdir
        self.read_status = ""
        self.res_name = ""
        self.files_info = {}
        self.file_md5 = ""
        self.upload_path = ""

    def _get_raw_header(self, data):
        idx = data.find(self.SEP)
        if idx >= 0:
            return (data[:idx], data[idx + self.LSEP:])
        else:
            return (None, data)

    def receive(self, chunk):
        self.received += len(chunk)
        self.on_progress()
        self.buf += chunk
        # print "chunk = " + chunk

        if not self.delimiter:
            self.delimiter, self.buf = self._get_raw_header(self.buf)
            if self.delimiter:
                self.delimiter += self.SEP
                self.dlen = len(self.delimiter)
            elif len(self.buf) > 1000:
                raise Exception("Cannot find multipart delimiter")
            else:
                return

        while True:
            if self.in_data:
                if (len(self.buf) > 3 * self.dlen):
                    idx = self.buf.find(self.SEP + self.delimiter)
                    if idx >= 0:
                        self.feed_part(self.buf[:idx])
                        self.end_part()
                        self.buf = self.buf[
                            idx + len(self.SEP + self.delimiter):]
                        self.in_data = False
                    else:
                        limit = len(self.buf) - 2 * self.dlen
                        self.feed_part(self.buf[:limit])
                        self.buf = self.buf[limit:]
                        return
                else:
                    return
            if not self.in_data:
                while True:
                    header, self.buf = self._get_raw_header(self.buf)
                    if header == b"":
                        assert(self.delimiter)
                        self.in_data = True
                        self.begin_part(self.headers)
                        self.headers = []
                        break
                    elif header:
                        self.headers.append(self.parse_header(header))
                    else:
                        # Header is None, not enough data yet
                        return

    def parse_header(self, header):
        header = header.decode(self.header_encoding)
        res = self.PAT_HEADERVALUE.match(header)
        if res:
            name, value, tail = res.groups()
            params = {}
            hdr = {"name": name, "value": value, "params": params}
            while True:
                res = self.PAT_HEADERPARAMS.match(tail)
                if not res:
                    break
                fname, fvalue, tail = res.groups()
                params[fname] = fvalue
            return hdr
        else:
            return {"value": header}

    def begin_part(self, headers):
        """Internal method called when a new part is started."""

        for header in headers:
            logger.info(header)
            if header.get("name", "").lower().strip() == "content-disposition":
                params = header.get("params", [])

        is_fileinfo_header = False
        if 0 != len(params):
            for name in params:
                if name.lower().strip() == "filename":
                    is_fileinfo_header = True

        if not is_fileinfo_header:
            self.fout = None
            return

        origin_path = ""    
        if 0 != len(params):
            for name in params:
                if name.lower().strip() == "filename":
                    file_name = params[name]
                if name.lower().strip() == "name":
                    self.file_md5 = (params[name])[(params[name].find("|") + 1):]
                    origin_path = (params[name])[:params[name].find("|")] 
                    if IS_WINDOWS:
                        origin_path = origin_path.replace('/','\\')                 
                        self.upload_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), UPLOAD_PATH, origin_path)
                        relative_path = self.upload_path[:self.upload_path.rfind('\\')]
                    else:
                        self.upload_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), UPLOAD_PATH, origin_path)
                        relative_path = self.upload_path[:self.upload_path.rfind('/')]
                   
                    if not os.path.exists(relative_path):
                        # 如果要上传的路径没有相应的文件夹，则创建
                        logger.info('relative_path:'+str(relative_path))
                        os.makedirs(relative_path)

        if self.file_md5:
            try:
                self.fout = open(self.upload_path, "w+b")
            except:

                self.fout = None
                traceback.print_exc()
                logger.error("open %s failed!" % self.upload_path)
        else:
            self.fout = None

        self.part = {
            "headers": headers,
            "size": 0,
            "tmpfile": self.fout,
            "path": self.upload_path
        }
        self.parts.append(self.part)
        # if is windows system, then we will add more backslash avoid escape
        if IS_WINDOWS:
            self.upload_path = self.upload_path.replace('\\','\\\\')
        self.files_info = {"file_path": self.upload_path, "file_md5": self.file_md5, "file_savein_db": True, "file_name": file_name}

    def feed_part(self, data):
        """Internal method called when content is added to the current part."""

        if self.fout != None:

            self.fout.write(data)
            self.part["size"] += len(data)

    def end_part(self):
        """
        # Internal method called when receiving the current part has finished.
        # Will not close the file here, so we will be able to read later.
        """
        # This is not needed because we update part["size"]
        # self.fout.close()
        # self.fout.flush()
        pass

    def finish_receive(self):
        """
        Call this after the last receive() call.
        You MUST call this before using the parts.
        """
        if self.in_data:
            idx = self.buf.rfind(self.SEP + self.delimiter[:-2])
            if idx > 0:
                self.feed_part(self.buf[:idx])
            self.end_part()

    def release_parts(self):
        """Call this to remove the temporary files."""
        for part in self.parts:
            if part["tmpfile"] != None:
                part["tmpfile"].close()
        #提高上传文件的读写执行权限
        os.chmod(self.files_info["file_path"], stat.S_IRWXU|stat.S_IRWXG|stat.S_IRWXO) 
    def get_part_payload(self, part):
        """
        Return the contents of a part.
        Warning: do not use this for big files!
        """
        # fsource = part["tmpfile"]
        # fsource.seek(0)
        # return fsource.read()
        pass

    def get_part_ct_params(self, part):
        """
        Get content-disposition parameters.
        If there is no content-disposition header then it returns an empty list.
        """
        for header in part["headers"]:
            if header.get("name", "").lower().strip() == "content-disposition":
                return header.get("params", [])
        return []

    def get_part_ct_param(self, part, pname, defval=None):
        """
        Get parameter for a part.
        @param part: The part
        @param pname: Name of the parameter, case insensitive
        @param defval: Value to return when not found.
        """
        ct_params = self.get_part_ct_params(part)
        for name in ct_params:
            if name.lower().strip() == pname:
                return ct_params[name]
        return defval

    def get_part_name(self, part):
        """
        Get name of a part.
        When not given, returns None.
        """
        return self.get_part_ct_param(part, "name", None)

    def get_parts_by_name(self, pname):
        """
        Get a parts by name.
        @param pname: Name of the part. This is case sensitive!
        Attention! A form may have posted multiple values for the same
        name. So the return value of this method is a list of parts!
        """
        res = []
        for part in self.parts:
            name = self.get_part_name(part)
            if name == pname:
                res.append(part)
        return res

    def get_values(self, fnames, size_limit=10 * 1024):
        """
        Return a dictionary of values for the given field names.
        @param fnames: A list of field names.
        @param size_limit: Maximum size of the value of a single field.
            If a field's size exceeds this then SizeLimitError is raised.  
        Warning: do not use this for big file values.
        Warning: a form may have posted multiple values for a field name.
            This method returns the first available value for that name.
            To get all values, use the get_parts_by_name method.
        Tip: use get_nonfile_names() to get a list of field names
            that are not originally files.
        """
        res = {}
        for fname in fnames:
            parts = self.get_parts_by_name(fname)
            if not parts:
                raise KeyError("No such field: %s" % fname)
            size = parts[0]["size"]
            if size > size_limit:
                raise SizeLimitError("Part size=%s > limit=%s" % (size, limit))
            res[fname] = self.get_part_payload(parts[0])
        return res

    def get_nonfile_names(self):
        """
        Get a list of part names are originally not files.
        It examines the filename attribute of the content-disposition header.
        Be aware that these fields still may be huge in size.
        """
        res = []
        for part in self.parts:
            filename = self.get_part_ct_param(part, "filename", None)
            if filename is None:
                name = self.get_part_name(part)
                if name:
                    res.append(name)
        return res

    def examine(self):
        """Debugging method for examining received data."""
        logger.debug("============= structure =============")
        for idx, part in enumerate(self.parts):
            logger.debug("PART #%d" % (idx))
            logger.debug("HEADERS")
            logger.debug("sub------%s" % repr(part))
            for header in part["headers"]:
                logger.debug("%s = %s" % (repr(header.get("name", "")),
                                          repr(header.get("value", ""))))
                params = header.get("params", None)
                if params:
                    for pname in params:
                        logger.debug("%s = %s" % (repr(pname),
                                                  repr(params[pname])))
            logger.debug("DATA")
            logger.debug("SIZE %d" % part["size"])
            if (part["tmpfile"] != None):
                logger.debug("LOCATION %s" % part["tmpfile"].name)
            if part["size"] < 80:
                logger.debug("PAYLOAD:%s" % repr(self.get_part_payload(part)))
            else:
                logger.debug("PAYLOAD: <too long...>")
        logger.debug("========== non-file values ==========")
        logger.debug(self.get_values(self.get_nonfile_names()))
        logger.debug("javascript md5:" + self.file_md5)

    def on_progress(self):
        """Override this function to handle progress of receiving data."""
        pass
if __name__ == '__main__':
    pass