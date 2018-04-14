import * as net from 'net';

export enum SoundFunction {
    notAvailable = 0x00,
    available = 0x01
}
export enum ProfileNumber {
    notAvailable = 0x00,
    clockFunction = 0x01,
    sleepTimerFunction = 0x02,
    clockFunctionAndSleepTimerFunction = 0x03
}

const commands = {
    power: {
        on: [0x02, 0x00, 0x00, 0x00, 0x00, 0x02],
        off: [0x02, 0x01, 0x00, 0x00, 0x00, 0x03]
    },
    picture: {
        mute: {
            on: [0x02, 0x10, 0x00, 0x00, 0x00, 0x12],
            off: [0x02, 0x11, 0x00, 0x00, 0x00, 0x13]
        }
    },
    sound: {
        mute: {
            on: [0x02, 0x12, 0x00, 0x00, 0x00, 0x14],
            off: [0x02, 0x12, 0x00, 0x00, 0x00, 0x14]

        }
    },
    onscreen: {
        mute: {
            on: [0x02, 0x14, 0x00, 0x00, 0x00, 0x16],
            off: [0x02, 0x15, 0x00, 0x00, 0x00, 0x17]
        }
    },
    status: {
        runningStatusRequest: [0x00, 0x85, 0x00, 0x00, 0x01, 0x01, 0x87]
    },
    settings: {
        readState: [0x00, 0x85, 0x00, 0x00, 0x01, 0x00, 0x86]
    }
}

const errorCodeList = {
    '00': {
        '00': 'The command cannot be recognized.',
        '01': 'The command is not supported by the model in use.'
    },
    '01': {
        '00': 'The specified value is invalid',
        '01': 'The specified input terminal is invalid',
        '02': 'The specified language is invalid'
    },
    '02': {
        '00': 'Memory allocation error',
        '02': 'Memory in use',
        '03': 'The specified value cannot be used',
        '04': 'Forced onscreen mute on',
        '06': 'Viewer error',
        '07': 'No signal',
        '08': 'A test pattern or filter is displayed',
        '09': 'No PC card is inserted',
        '0A': 'Memory operation error',
        '0C': 'An entry list is displayed',
        '0D': 'The command cannot be accepted because the power is off',
        '0E': 'The command execution failed',
        '0F': 'There is no authority necessary for the operation.',
    },
    '03': {
        '00': 'The specified gain number is incorrect.',
        '01': 'The specified gain is invalid',
        '02': 'Adjustment failed'
    }
}


function toHexArray(byteArray) {
    return Array.prototype.map.call(byteArray, function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    });
}

let socket: net.Socket = new net.Socket({
    allowHalfOpen: true,
    readable: true,
    writable: true
}).connect({
    host: '192.168.10.21',
    port: 7142
}, () => {
    console.log('Connected, trying to send read state command');
    socket.write(new Uint8Array(commands.status.runningStatusRequest));
});

/**
 * The value of the "Control ID" set for the projector is used.
 */
type ControlID = number;
/**
 * This varies depending on the model in use.
 */
type ModelCode = number;

const operationStatus = {
    '00': 'Standby (Sleep)',
    '04': 'Power on',
    '05': 'Cooling',
    '06': 'Standby (error)',
    '0F': 'Standby (Power saving)',
    '10': 'Network standby',
    'FF': 'Not supported'
}

export class ProjectorController {
    id: [ControlID, ModelCode];
    data = {
        success: false,
        err1: null,
        err2: null,
        errText: null,
        baseModelType: null,
        soundFunction: null,
        profileNumber: null,
        systemReserved: null
    }
    status = {
        on: false,
        power: {
            coolingProcess: false,
            powerOnOffProcess: false,
            operationStatus: operationStatus['00']
        },
        picture: {
            mute: false,
            freeze: false
        },
        sound: {
            mute: false
        },
        onscreen: {
            mute: false
        }
    }

    setId(id1: ControlID, id2: ModelCode) {
        this.id = [id1, id2];
    }

    setError(err1: number, err2: number, errMessage: string) {
        console.error('Error: ', err1, err2, errMessage);
    }

    turnOn() {
        socket.write(commands.power.on);
    }

    parseResponse(response: Uint8Array): boolean {
        let hex = toHexArray(response) as Array<number>;
        let origin = hex.shift();
        let code: number = undefined;
        switch(origin) {
            case 0x20:
                /**
                 * 3.33 [078-1. SETTING REQUEST]
                 *  - SUCCESS RESPONSE
                 */
                code = hex.shift();
                this.setId(hex.shift(), hex.shift());
                switch(code) {
                    case 0x85:
                        if(hex.shift() === 0x10) {
                            let systemReserved = [hex.shift(), hex.shift()];
                            // Power status
                            this.status.on = (hex.shift() === 0x01) ? true : false;
                            this.status.power.coolingProcess = (hex.shift() === 0x01) ? true : false;
                            this.status.power.powerOnOffProcess = (hex.shift() === 0x01) ? true : false;
                            this.status.power.operationStatus = operationStatus[hex.shift().toString(16)];
                            return true;
                        }
                        return false;
                    default: 
                        return false;
                }
                break;
            case 0x22:
                code = hex.shift();
                this.setId(hex.shift(), hex.shift());
                switch(code) {
                    case 0x00:
                        this.status.on = true;
                        return true;
                    case 0x01:
                        this.status.on = false;
                        return true;
                    case 0x10:
                        this.status.picture.mute = true;
                        return true;
                    case 0x11:
                        this.status.picture.mute = false;
                        return true;
                    case 0x12: 
                        this.status.sound.mute = true;
                        return true;
                    case 0x13:
                        this.status.sound.mute = false;
                        return true;
                    case 0x14:
                        this.status.onscreen.mute = true;
                        return true;
                    case 0x15:
                        this.status.onscreen.mute = false;
                        return true;
                    
                    default:
                        return false;
                }
            case 0xA2:
            case 0xA0:
                code = hex.shift();
                this.setId(hex.shift(), hex.shift());
                let message = 'UNKNOWN';
                if(hex.shift() !== 0x02) {
                    console.error('Could not decode error....', toHexArray(response));
                    message = 'UNKNOWN CODE - WRONG BYTE, missing 0x02';
                }
                switch(code) {
                    case 0x10:
                        if(origin === 0xA2) {
                            message = 'Picture mute on failed';
                        }
                        break;
                    case 0x11:
                        if(origin === 0xA2) {
                            message = 'Picture mute off failed';
                        }
                        break;
                    case 0x12:
                        message = 'Sound mute on failed';
                        break;
                    case 0x13:
                        message = 'Sound mute off failed';
                        break;
                    case 0x14:
                        message = 'OnScreen mute on failed';
                        break;
                    case 0x15:
                        message = 'OnScreen mute off failed';
                        break;
                    case 0x85:
                        message = 'Settings request - response failed';
                        break;
                    default:
                        message = 'Unknown error - code not found';
                }
                this.setError(hex.shift(), hex.shift(), message);
                break;
            default:
                return false;
        }
    }


    decodeError(err1: number, err2: number): string {
        if(errorCodeList[err1] && errorCodeList[err1][err2]) {
            return errorCodeList[err1][err2];
        } else {
            return 'UNKNOWN ERROR';
        }
    }
}

let projector = new ProjectorController();

socket.on('data', function(data) {
    console.log('Received: ', projector.parseResponse(data));
    console.log(projector.status);
	socket.destroy(); // kill client after server's response
});

socket.on('close', function() {
	console.log('Connection closed');
});


