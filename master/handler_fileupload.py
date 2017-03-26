#!/usr/bin/python
# -*- coding: utf-8 -*-


import os
import sys
import json
import tornado.gen
import tornado.web
import time

import globalvar
import shutil

from log import Logger
from testcase_upload import TestCaseUpload
from tornado.web import stream_request_body
from tornado.concurrent import Future
from globalvar import UPLOAD_PATH
from globalvar import IS_WINDOWS
from db_fileupload import UploadFileData


logger = Logger('hanlder_fileupload')

class FileUploadInstance(TestCaseUpload):
    percent = 0

    def on_progress(self):
        """Override this function to handle progress of receiving data."""
        if self.total:
            new_percent = self.received * 100 // self.total
            if new_percent != self.percent:
                self.percent = new_percent
                logger.info("progress: " + str(new_percent))


class CheckFileMd5Handler(tornado.web.RequestHandler):
    """处理上传用例模块实际上传文件前检测服务器MD5值是否相同并做处理

    Returns：
    1、字符串 0 代表该文件首次上传或者实际文件已被删除
    2、字符串 1 代表该文件存在要上传的路径或者其他路径中
    """

    def post(self):
        file_md5 = self.get_argument("file_md5")
        get_md5 = UploadFileData().get_file_info(file_md5=file_md5)
        logger.info("get_md5:" + str(get_md5))
        if get_md5 == ():
            # 上传文件的md5不存在，直接上传
            self.write("0")
            return
        else:
            file_path = self.get_argument("file_path")
            file_name = file_path[(file_path.rfind("/") + 1):]
            file_realative_folder =  file_path[:file_path.rfind("/")]
            if IS_WINDOWS:
                file_realative_folder.replace('/','\\')
            # combinate the upload path without filename
            file_upload_relative_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), UPLOAD_PATH, file_realative_folder)
            # combinate the upload path contains the filename
            file_upload_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), UPLOAD_PATH, file_realative_folder, file_name)
            # 根据文件路径查找文件，并且查询路径区分大小写
            get_file_by_filepath = UploadFileData().get_file_by_file_path(file_path=file_upload_path.replace('\\','\\\\'))
           
            logger.info("get_file_by_filepath:" + str(get_file_by_filepath))
            file_flag = file_name[(file_name.rfind(".") + 1):]
            file_savein_db = True
            # 先检查要上传的路径有没存在同名文件
            if not get_file_by_filepath == ():
                # 确认要上传路径文件是否被删除,同时检测上传路径文件MD5是否与要上传文件一致
                copy_to_path = file_upload_path
                if os.path.exists(get_file_by_filepath[0]["FilePath"]) and get_file_by_filepath[0]["FileMD5"] == file_md5:
                    copy_from_path = get_file_by_filepath[0]["FilePath"]
                else:
                    file_exist_flag, copy_from_path = self.__check_otherpath_file(get_md5)
                    if not file_exist_flag:
                        self.write("0")
                        return
            else:
                copy_to_path = file_upload_path
                file_exist_flag, copy_from_path = self.__check_otherpath_file(get_md5)
                if not file_exist_flag:
                    self.write("0")
                    return

            logger.info("copy_from_path:" + copy_from_path)
            logger.info("copy_to_path:" + copy_to_path)
            if copy_from_path == copy_to_path:
                file_savein_db = False
                logger.info("file is at the same path and both have same case")
                FileSaveDBHandler_Instance = FileSaveDBHandler(file_name, file_upload_path.replace('\\','\\\\'), file_md5, file_savein_db)
                FileSaveDBHandler_Instance.file_save_in_db_handler()
                self.write("1")
                return

            if copy_from_path.lower() == copy_to_path.lower():
                # 当前路径存在该文件，但是名字大小写不一致
                if file_flag == 'py' and file_type == "testcase":
                    logger.info("testcase exists at the same path,so rename exits file_name: "
                                + copy_from_path + " to :" + copy_to_path)

                    os.rename(copy_from_path, copy_to_path)
                else:
                    # 针对非testcase文件，文件名如果大小写一致，会复制要上传路径文件，否则复制其他路径文件
                    logger.info("file exits at same path,but the case is not the same,copy file from: "
                                + copy_from_path + " to: " + copy_to_path)
                    shutil.copy(copy_from_path, copy_to_path)
            else:
                if not os.path.exists(file_upload_relative_path):
                    # 如果要上传的路径没有相应的文件夹，则创建
                    os.makedirs(file_upload_relative_path)
                logger.info("file exits at different path ,copy file from: "+ copy_from_path + " to: " + copy_to_path)
                shutil.copy(copy_from_path, copy_to_path)

            self.write("1")
            FileSaveDBHandler_Instance = FileSaveDBHandler(file_name, file_upload_path.replace('\\','\\\\'), file_md5, file_savein_db)
            FileSaveDBHandler_Instance.file_save_in_db_handler()

    def __check_otherpath_file(self, get_md5):
        """逐个查找其他路径存在相同内容的文件并确认是否被删除

        """
        file_exist_flag = False
        valid_copy_from_path = None
        for same_md5_file in get_md5:
            if os.path.exists(same_md5_file["FilePath"]):
                # 寻找没有被删除的md5相同的文件
                valid_copy_from_path = same_md5_file["FilePath"]
                file_exist_flag = True
                break
                logger.error("the target file[" + same_md5_file["FilePath"] +"] which want to be copied or renamed has been removed ")
                file_data = UploadFileData().get_file_info(file_path=same_md5_file["FilePath"])
                if len(file_data) is not 0:
                    UploadFileData().delete_file_info(file_data[0]["FileID"])
        return file_exist_flag, valid_copy_from_path


@stream_request_body
class StreamHandler(tornado.web.RequestHandler):

    def post(self):
        try:
            self.ps.finish_receive()
            # Use parts here!
            self.set_header("Content-Type", "text/plain")
            self.ps.examine()
        finally:
            # Don't forget to release temporary files.
            self.ps.release_parts()

        path = self.ps.files_info["file_path"]
        file_savein_db = self.ps.files_info["file_savein_db"]
        file_md5 = self.ps.files_info["file_md5"]
        file_name = self.ps.files_info["file_name"]
        FileSaveDBHandler_Instance = FileSaveDBHandler(file_name, path, file_md5, file_savein_db)
        FileSaveDBHandler_Instance.file_save_in_db_handler()
        res = {"files": [{"name": file_name, "status": "上传成功", }]}
        self.write(res)

    def prepare(self):
        # TODO: get content length here?
        try:
            total = int(self.request.headers.get("Content-Length", "0"))
        except:
            total = 0
        self.ps = FileUploadInstance(total)

    def data_received(self, chunk):

        try:
            file_savein_db = self.ps.files_info["file_savein_db"]
            if file_savein_db:
                self.ps.receive(chunk)
        except:
            self.ps.receive(chunk)


class FileSaveDBHandler(object):
    """record file info onto db

    """

    def __init__(self, file_name, file_path, file_md5, file_savein_db):
        self.file_path = file_path
        self.file_md5 = file_md5
        self.file_name = file_name
        self.file_savein_db = file_savein_db

    def file_save_in_db_handler(self):
        if not self.file_savein_db:
            return
        else:
            # 查找要上传路径是否存在相同名字的文件(不区分大小写)，删除记录和文件
            file_data = UploadFileData().get_file_info(file_path=self.file_path)
            for temp_file in file_data:
                if temp_file["FilePath"] == self.file_path:
                    continue
                if os.path.exists(temp_file["FilePath"]):
                    os.remove(temp_file["FilePath"])
                UploadFileData().delete_file_info(temp_file["FileID"])
            UploadFileData().save_file_info(self.file_name, self.file_path, self.file_md5)
