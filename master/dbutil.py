#!/usr/bin/python
# -*- coding: utf-8 -*-

import os
import sys
import ConfigParser
import threading
import MySQLdb.cursors
import globalvar
import MySQLdb as Database

from log import Logger
from warnings import filterwarnings
from common_func import singleton
filterwarnings('ignore', category=Database.Warning)

logger = Logger('dbutil')

DBConnection = None
_conn_lock = None


@singleton
class DBUtil():

    def __init__(self):
        global _conn_lock
        _conn_lock = threading.Lock()
        self.connect_db()

    def connect_db(self):
        cf = ConfigParser.SafeConfigParser()
        cf.read(globalvar.CONFIG_FILE)
        try:
            global DBConnection
            DBConnection = MySQLdb.Connect(
                host=cf.get("db", "ip"),
                port=int(cf.get("db", "port")),
                user=cf.get("db", "user"),
                passwd=cf.get("db", "pwd"),
                db=cf.get("db", "database"),
                charset='utf8',
                cursorclass=MySQLdb.cursors.DictCursor)

        except MySQLdb.Error, e:
            logger.error("Connect Database Error Info: [%d]-[%s]" % (e.args[0], e.args[1]))

    def get_data(self, sqlString):
        _conn_lock.acquire()
        try:
            DBConnection.ping()
        except:
            self.connect_db()

        try:
            cursor = DBConnection.cursor()
            cursor.execute(sqlString)
            returnData = cursor.fetchall()
            cursor.close()
            DBConnection.close()
            _conn_lock.release()
            return returnData
        except MySQLdb.Error, e:
            cursor.close()
            DBConnection.close()
            _conn_lock.release()
            logger.error("GetData Error Info: [%d]-[%s]" % (e.args[0], e.args[1]))
            logger.info('GetData Error SQL: %s' % sqlString)
            return ()

    def exec_sql(self, sqlString):
        _conn_lock.acquire()
        try:
            DBConnection.ping()
        except:
            self.connect_db()

        try:
            cursor = DBConnection.cursor()
            cursor.execute(sqlString)
            DBConnection.commit()
            cursor.close()
            DBConnection.close()
            _conn_lock.release()
            return True
        except MySQLdb.Error, e:
            cursor.close()
            DBConnection.close()
            _conn_lock.release()
            logger.error("ExecSQL Error Info: [%d]-[%s]" % (e.args[0], e.args[1]))
            logger.info('ExecSQL Error SQL: %s' % sqlString)
            return False

    def close_db(self):
        pass

if __name__ == "__main__":
    try:
        db_connection = DBUtil()
        db_connection.connect_db()
        logger.info(db_connection.get_data("select * from TestCase"))
    finally:
        db_connection.close_db()
