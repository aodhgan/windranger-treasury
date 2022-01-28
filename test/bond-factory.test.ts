// Start - Support direct Mocha run & debug
import 'hardhat'
import '@nomiclabs/hardhat-ethers'
// End - Support direct Mocha run & debug

import chai, {expect} from 'chai'
import {before} from 'mocha'
import {solidity} from 'ethereum-waffle'
import {
    BitDAO,
    BondFactory,
    Box,
    ERC20PresetMinterPauser,
    ERC20
} from '../typechain-types'
import {
    deployContract,
    deployContractWithProxy,
    execute,
    signer
} from './framework/contracts'
import {constants} from 'ethers'
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers'
import {verifyCreateBondEvent} from './contracts/bond/verify-bond-creator-events'
import {ExtendedERC20} from './contracts/cast/extended-erc20'
import {accessControlRevertMessage} from './contracts/bond/bond-access-control-messages'
import {BOND_ADMIN} from './contracts/bond/roles'
import {successfulTransaction} from './framework/transaction'

// Wires up Waffle with Chai
chai.use(solidity)

const ADDRESS_ZERO = constants.AddressZero

describe('Bond Factory contract', () => {
    before(async () => {
        admin = (await signer(0)).address
        treasury = (await signer(1)).address
        nonAdmin = await signer(2)
        collateralTokens = await deployContract<BitDAO>('BitDAO', admin)
        collateralSymbol = await collateralTokens.symbol()
        bonds = await deployContractWithProxy<BondFactory>(
            'BondFactory',
            collateralTokens.address
        )
    })

    describe('create bond', () => {
        it('non-whitelisted collateral', async () => {
            await expect(
                bonds.createBond(
                    {name: 'Named bond', symbol: 'AA00AA'},
                    {
                        debtTokens: 101n,
                        collateralTokenSymbol: 'BEEP',
                        expiryTimestamp: 0n,
                        minimumDeposit: 0n,
                        treasury: treasury,
                        data: ''
                    }
                )
            ).to.be.revertedWith('BF: collateral not whitelisted')
        })

        it('whitelisted (BIT) collateral', async () => {
            const bondName = 'Special Debt Certificate'
            const bondSymbol = 'SDC001'
            const debtTokenAmount = 555666777n
            const collateralSymbol = 'BIT'
            const expiryTimestamp = 560000n
            const minimumDeposit = 100n
            const data = 'a random;delimiter;separated string'

            const receipt = await execute(
                bonds.createBond(
                    {name: bondName, symbol: bondSymbol},
                    {
                        debtTokens: debtTokenAmount,
                        collateralTokenSymbol: collateralSymbol,
                        expiryTimestamp: expiryTimestamp,
                        minimumDeposit: minimumDeposit,
                        treasury: treasury,
                        data: data
                    }
                )
            )

            await verifyCreateBondEvent(
                {
                    name: bondName,
                    debtSymbol: bondSymbol,
                    debtAmount: debtTokenAmount,
                    creator: admin,
                    treasury: treasury,
                    expiryTimestamp: expiryTimestamp,
                    data: data
                },
                receipt
            )
        })
        it('only when not paused', async () => {
            await successfulTransaction(bonds.pause())
            expect(await bonds.paused()).is.true

            await expect(
                bonds.createBond(
                    {name: 'Named bond', symbol: 'AA00AA'},
                    {
                        debtTokens: 101n,
                        collateralTokenSymbol: 'BEEP',
                        expiryTimestamp: 0n,
                        minimumDeposit: 0n,
                        treasury: treasury,
                        data: ''
                    }
                )
            ).to.be.revertedWith('Pausable: paused')
        })
    })

    describe('collateral whitelist', () => {
        before(async () => {
            await bonds.unpause()
        })
        describe('add', () => {
            it('new token', async () => {
                const symbol = 'EEK'
                const tokens = await deployContract<ERC20PresetMinterPauser>(
                    'ERC20PresetMinterPauser',
                    'Another erc20 Token',
                    symbol
                )
                expect(await tokens.symbol()).equals(symbol)

                await bonds.whitelistCollateral(tokens.address)

                expect(await bonds.isCollateralWhitelisted(symbol)).is.true
                expect(await bonds.whitelistedCollateralAddress(symbol)).equals(
                    tokens.address
                )
            })

            it('cannot be an existing token', async () => {
                await expect(
                    bonds.whitelistCollateral(collateralTokens.address)
                ).to.be.revertedWith('Whitelist: already present')
            })

            it('cannot have address zero', async () => {
                await expect(
                    bonds.whitelistCollateral(ADDRESS_ZERO)
                ).to.be.revertedWith('Whitelist: zero address')
            })

            it('cannot be a non-erc20 contract (without fallback)', async () => {
                const box = await deployContract<Box>('Box')

                await expect(
                    bonds.whitelistCollateral(box.address)
                ).to.be.revertedWith(
                    "function selector was not recognized and there's no fallback function"
                )
            })

            it('only bond admin', async () => {
                await expect(
                    bonds
                        .connect(nonAdmin)
                        .whitelistCollateral(collateralTokens.address)
                ).to.be.revertedWith(
                    accessControlRevertMessage(nonAdmin, BOND_ADMIN)
                )
            })

            it('only when not paused', async () => {
                await successfulTransaction(bonds.pause())
                expect(await bonds.paused()).is.true
                const symbol = 'EEK'
                const tokens = await deployContract<ERC20>(
                    'ERC20',
                    'Another erc20 Token',
                    symbol
                )
                expect(await tokens.symbol()).equals(symbol)

                await expect(
                    bonds.whitelistCollateral(tokens.address)
                ).to.be.revertedWith('Pausable: paused')
            })
        })

        describe('update', () => {
            before(async () => {
                await bonds.unpause()
            })
            it('cannot have identical value', async () => {
                await expect(
                    bonds.updateWhitelistedCollateral(collateralTokens.address)
                ).to.be.revertedWith('Whitelist: identical address')
            })

            it('cannot have address zero', async () => {
                await expect(
                    bonds.updateWhitelistedCollateral(ADDRESS_ZERO)
                ).to.be.revertedWith('Whitelist: zero address')
            })

            it('cannot be a non-contract address', async () => {
                await expect(
                    bonds.updateWhitelistedCollateral(admin)
                ).to.be.revertedWith('function call to a non-contract account')
            })

            it('cannot be a non-erc20 contract (without fallback)', async () => {
                const box = await deployContract<Box>('Box')

                await expect(
                    bonds.updateWhitelistedCollateral(box.address)
                ).to.be.revertedWith(
                    "function selector was not recognized and there's no fallback function"
                )
            })

            it('only bond admin', async () => {
                await expect(
                    bonds
                        .connect(nonAdmin)
                        .updateWhitelistedCollateral(collateralTokens.address)
                ).to.be.revertedWith(
                    accessControlRevertMessage(nonAdmin, BOND_ADMIN)
                )
            })

            it('existing address', async () => {
                const startingAddress =
                    await bonds.whitelistedCollateralAddress(collateralSymbol)
                expect(startingAddress).equals(collateralTokens.address)
                const altCollateralTokens = await deployContract<BitDAO>(
                    'BitDAO',
                    admin
                )
                expect(await altCollateralTokens.symbol()).equals(
                    collateralSymbol
                )
                expect(altCollateralTokens.address).not.equals(startingAddress)

                await bonds.updateWhitelistedCollateral(
                    altCollateralTokens.address
                )

                const updatedAddress = await bonds.whitelistedCollateralAddress(
                    collateralSymbol
                )
                expect(updatedAddress).not.equals(startingAddress)
            })

            it('only when not paused', async () => {
                await successfulTransaction(bonds.pause())
                expect(await bonds.paused()).is.true
                const symbol = 'EEK'
                const tokens = await deployContract<ERC20>(
                    'ERC20',
                    'Another erc20 Token',
                    symbol
                )
                expect(await tokens.symbol()).equals(symbol)

                await expect(
                    bonds.updateWhitelistedCollateral(tokens.address)
                ).to.be.revertedWith('Pausable: paused')
            })
        })

        describe('remove', () => {
            before(async () => {
                await bonds.unpause()
            })
            it('entry', async () => {
                expect(await bonds.isCollateralWhitelisted(collateralSymbol)).is
                    .true

                await bonds.removeWhitelistedCollateral(collateralSymbol)

                expect(await bonds.isCollateralWhitelisted(collateralSymbol)).is
                    .false
            })

            it('non-existent entry', async () => {
                const absentSymbol = 'A value not in the whitelist'
                expect(await bonds.isCollateralWhitelisted(absentSymbol)).is
                    .false

                await expect(
                    bonds.removeWhitelistedCollateral(absentSymbol)
                ).to.be.revertedWith('Whitelist: not whitelisted')
            })

            it('only bond admin', async () => {
                await expect(
                    bonds
                        .connect(nonAdmin)
                        .removeWhitelistedCollateral(collateralSymbol)
                ).to.be.revertedWith(
                    accessControlRevertMessage(nonAdmin, BOND_ADMIN)
                )
            })

            it('only when not paused', async () => {
                await successfulTransaction(bonds.pause())
                expect(await bonds.paused()).is.true
                const symbol = 'EEK'
                await expect(
                    bonds.removeWhitelistedCollateral(symbol)
                ).to.be.revertedWith('Pausable: paused')
            })
        })
    })

    describe('unpause', () => {
        before(async () => {
            await bonds.unpause()
        })
        it('changes state', async () => {
            await bonds.pause()

            expect(await bonds.paused()).is.true

            await bonds.unpause()

            expect(await bonds.paused()).is.false
        })

        it('only bond admin', async () => {
            await expect(bonds.connect(nonAdmin).pause()).to.be.revertedWith(
                accessControlRevertMessage(nonAdmin, BOND_ADMIN)
            )
        })

        it('only when paused', async () => {
            await expect(bonds.unpause()).to.be.revertedWith(
                'Pausable: not paused'
            )
        })
    })

    let admin: string
    let treasury: string
    let nonAdmin: SignerWithAddress
    let collateralTokens: ExtendedERC20
    let collateralSymbol: string
    let bonds: BondFactory
})
