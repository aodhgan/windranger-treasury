import {BaseContract, ContractReceipt} from 'ethers'
import {
    ActualAddBondEvent,
    addBondEventLogs,
    addBondEvents
} from './bond-curator-events'
import {eventLog} from '../../framework/event-logs'
import {verifyOrderedEvents} from '../../framework/verify'
import {events} from '../../framework/events'

type ExpectedAddBondEvent = {bond: string}

/**
 * Verifies the content for an Add Bond event.
 */
export function verifyAddBondEvents(
    receipt: ContractReceipt,
    bonds: ExpectedAddBondEvent[]
): void {
    const actualEvents = addBondEvents(events('AddBond', receipt))

    verifyOrderedEvents(
        actualEvents,
        bonds,
        (actual: ActualAddBondEvent, expected: ExpectedAddBondEvent) =>
            deepEqualsAddBondEvent(actual, expected)
    )
}

/**
 * Verifies the event log entries contain the expected Add Bond events.
 */
export function verifyAddBondLogEvents<T extends BaseContract>(
    emitter: T,
    receipt: ContractReceipt,
    bonds: ExpectedAddBondEvent[]
): void {
    const actualEvents = addBondEventLogs(eventLog('AddBond', emitter, receipt))

    verifyOrderedEvents(
        actualEvents,
        bonds,
        (actual: ActualAddBondEvent, expected: ExpectedAddBondEvent) =>
            deepEqualsAddBondEvent(actual, expected)
    )
}

function deepEqualsAddBondEvent(
    actual: ActualAddBondEvent,
    expected: ExpectedAddBondEvent
): boolean {
    return actual.bond === expected.bond
}
