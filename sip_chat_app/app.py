from flask import Flask, render_template
from flask_socketio import SocketIO, emit
from sip_protocol import parse_sip_message

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('sip_message')
def handle_sip_message(raw_message):
    data = parse_sip_message(raw_message)
    print(f"[SERVER] Получено SIP-сообщение: {data}")

    # Рассылаем всем клиентам (broadcast)
    emit('sip_message', raw_message, broadcast=True)

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)


