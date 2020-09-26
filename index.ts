import * as stream from 'stream'

const DEFAULT_FILTERS = [
	{ vendorId: 0x2341, productId: 0x8036 }, // Arduino Leonardo
	{ vendorId: 0x2341, productId: 0x8037 }, // Arduino Micro
	{ vendorId: 0x239a, productId: 0x8011 } // Adafruit Circuit Playground
]

type Callback<T = never> = (param?: T) => void

export type WebUSBSerialPortOptions = { 
	filters?: USBDeviceFilter[], 
	device?: USBDevice 
}

export default class WebUSBSerialPort extends stream.Stream {
	public device?: USBDevice

	constructor (options?: WebUSBSerialPortOptions) {
		super()
		this.handleDevice(options)
	}

	open (callback: Callback) {
		this.emit('open')
		callback?.()
	}

	async write (data: BufferSource, callback?: Callback<null | Error>) {
		try {
			await this.device?.transferOut(4, data)
			callback?.(null)
		}
		catch (error) {
			callback?.(error)
		}
	}

	async close (callback?: Callback) {
		if (!this.device) return

		await this.device.controlTransferOut({
			requestType: 'class',
			recipient: 'interface',
			request: 0x22,
			value: 0x00,
			index: 0x02
		})
		await this.device.close()
		callback?.()
	}

	flush (callback?: Callback) {
		callback?.()
	}

	drain (callback?: Callback) {
		callback?.()
	}

	private async handleDevice (options?: WebUSBSerialPortOptions) {
		try {
			const filters = options?.filters || DEFAULT_FILTERS
			const device = options?.device || await navigator.usb.requestDevice({ filters })
			await device.open()
			if (device.configuration?.configurationValue !== 1)
				await device.selectConfiguration(1)

			await device.claimInterface(2)
			await device.controlTransferOut({
				requestType: 'class',
				recipient: 'interface',
				request: 0x22,
				value: 0x01,
				index: 0x02
			})

			this.emit('open')
			this.readLoop(device)
		} catch (error) {
			this.emit('error', error)
		}
	}

	private async readLoop (device: USBDevice) {
		try {
			const result = await device.transferIn(5, 64)
			this.emit('data', Buffer.from(result.data!.buffer))
			this.readLoop(device)
		} catch (error) {
			this.emit('error', error)
		}
	}

}
