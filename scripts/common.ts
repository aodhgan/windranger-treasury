import {ethers, run} from 'hardhat'
import {log} from '../config/logging'
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers'

export async function deployContract<T extends DeployableContract<T>>(
    name: string,
    ...args: Array<unknown>
): Promise<T> {
    const factory = await ethers.getContractFactory(name)
    const contract = <T>(<unknown>await factory.deploy(...args))

    log.info('%s deployed to: %s', name, contract.address)

    return contract.deployed()
}

export async function verifyContract<T extends DeployableContract<T>>(
    contract: T,
    ...args: Array<unknown>
): Promise<void> {
    log.info('Verifying contract with Etherscan: %s', contract.address)

    await run('verify:verify', {
        address: contract.address,
        constructorArguments: [...args]
    })
}

interface DeployableContract<T> {
    deployed(): Promise<T>
    address: string
}

export async function signer(index: number): Promise<SignerWithAddress> {
    const signers = await ethers.getSigners()

    if (index >= signers.length) {
        throw new Error('Configuration problem: too few signers!')
    }

    return signers[index]
}

export async function awaitContractPropagation() {
    const sleepyTimeMs = 1500
    log.info('Awaiting contract propagation for: %s ms', sleepyTimeMs)

    return new Promise((resolve) => {
        setTimeout(resolve, sleepyTimeMs)
    })
}
