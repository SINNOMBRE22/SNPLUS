# -*- coding: utf-8 -*-
# PDirect.py - PYTHON2 + Fake HTTP response + DIRECT local (LowLatency)

import socket
import threading
import select
import sys
import time
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("-l", "--local")
parser.add_argument("-p", "--port")
parser.add_argument("-c", "--contr")
parser.add_argument("-r", "--response")
parser.add_argument("-t", "--texto")
args = parser.parse_args()

LISTENING_ADDR = '0.0.0.0'

if args.port:
    LISTENING_PORT = int(args.port)
else:
    print "Deve ingresar el puerto que usara como socks..."
    sys.exit(1)

if args.local:
    LOCAL_PORT = int(args.local)
else:
    print "Deve seleccionar un puerto existente para redireccionar el trafico..."
    sys.exit(1)

PASS = str(args.contr) if args.contr else ""
STATUS_RESP = args.response if args.response else '200'
STATUS_TXT = args.texto if args.texto else ''

if STATUS_TXT == '':
    if STATUS_RESP == '101':
        STATUS_TXT = 'SN Switching Protocols'
    else:
        STATUS_TXT = 'Connection Established'

SERVER_NAME = "SinNombre"

BUFLEN = 4096 * 4
TIMEOUT = 60

def make_response():
    if STATUS_RESP == '101':
        return (
            'HTTP/1.1 101 <strong>' + STATUS_TXT + '</strong>\r\n'
            'Server: ' + SERVER_NAME + '\r\n'
            'Connection: Upgrade\r\n'
            'Upgrade: websocket\r\n'
            'Content-length: 0\r\n'
            '\r\n'
            'HTTP/1.1 200 Connection established\r\n'
            'Server: ' + SERVER_NAME + '\r\n'
            '\r\n'
        )
    return (
        'HTTP/1.1 200 <strong>' + STATUS_TXT + '</strong>\r\n'
        'Server: ' + SERVER_NAME + '\r\n'
        'Connection: keep-alive\r\n'
        'Content-length: 0\r\n'
        '\r\n'
        'HTTP/1.1 200 Connection established\r\n'
        'Server: ' + SERVER_NAME + '\r\n'
        '\r\n'
    )

RESPONSE = make_response()

def findHeader(head, header):
    try:
        aux = head.find(header + ': ')
        if aux == -1:
            return ''
        aux = head.find(':', aux)
        head = head[aux+2:]
        aux = head.find('\r\n')
        if aux == -1:
            return ''
        return head[:aux]
    except:
        return ''

def tune_socket(s):
    try:
        s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    except:
        pass
    try:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 262144)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 262144)
    except:
        pass

class Server(threading.Thread):
    def __init__(self, host, port):
        threading.Thread.__init__(self)
        self.running = False
        self.host = host
        self.port = port

    def run(self):
        self.soc = socket.socket(socket.AF_INET)
        self.soc.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.soc.settimeout(2)
        try:
            self.soc.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, 262144)
            self.soc.setsockopt(socket.SOL_SOCKET, socket.SO_SNDBUF, 262144)
        except:
            pass

        self.soc.bind((self.host, self.port))
        self.soc.listen(200)
        self.running = True

        try:
            while self.running:
                try:
                    c, addr = self.soc.accept()
                    c.setblocking(1)
                    tune_socket(c)
                except socket.timeout:
                    continue
                ConnectionHandler(c, addr).start()
        finally:
            self.running = False
            try:
                self.soc.close()
            except:
                pass

class ConnectionHandler(threading.Thread):
    def __init__(self, client, addr):
        threading.Thread.__init__(self)
        self.client = client
        self.addr = addr
        self.target = None
        self.pending = ''

    def close(self):
        try:
            self.client.close()
        except:
            pass
        try:
            if self.target:
                self.target.close()
        except:
            pass

    def connect_local(self):
        self.target = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        tune_socket(self.target)
        self.target.connect(('127.0.0.1', LOCAL_PORT))
        self.target.setblocking(1)

    def run(self):
        try:
            data = self.client.recv(BUFLEN)
            if not data:
                return

            split = findHeader(data, 'X-Split')
            if split != '':
                try:
                    self.client.settimeout(2)
                    second = self.client.recv(BUFLEN)
                    self.client.settimeout(None)
                    if second:
                        # Verificar si son headers HTTP o datos reales del protocolo
                        if 'HTTP' in second[:8] or '\r\n' in second[:64]:
                            # Son headers, descartar normalmente
                            self.pending = ''
                        else:
                            # Son datos reales del protocolo destino, guardar
                            self.pending = second
                except:
                    self.client.settimeout(None)
                    self.pending = ''

            if len(PASS) != 0:
                passwd = findHeader(data, 'X-Pass')
                if passwd != PASS:
                    self.client.send('HTTP/1.1 400 WrongPass!\r\n\r\n')
                    return

            self.client.sendall(RESPONSE)
            self.connect_local()

            # Reenviar datos reales capturados antes de iniciar el tunel
            if self.pending:
                self.target.sendall(self.pending)
                self.pending = ''

            self.tunnel()

        except:
            pass
        finally:
            self.close()

    def tunnel(self):
        socs = [self.client, self.target]
        count = 0
        while True:
            count += 1
            try:
                (recv, _, err) = select.select(socs, [], socs, 3)
            except:
                return

            if err:
                return

            if recv:
                for s in recv:
                    try:
                        buf = s.recv(BUFLEN)
                        if not buf:
                            return
                        if s is self.target:
                            self.client.sendall(buf)
                        else:
                            self.target.sendall(buf)
                        count = 0
                    except:
                        return

            if count >= TIMEOUT:
                return

def main():
    print "\n:-------PDirect PY2 (LowLatency)-------:\n"
    print "Listening addr: " + LISTENING_ADDR
    print "Listening port: " + str(LISTENING_PORT)
    print "Redirect -> 127.0.0.1:" + str(LOCAL_PORT)
    print "Response: " + STATUS_RESP + " " + STATUS_TXT
    print ":-------------------------------------:\n"

    server = Server(LISTENING_ADDR, LISTENING_PORT)
    server.start()

    while True:
        time.sleep(2)

if __name__ == '__main__':
    main()
