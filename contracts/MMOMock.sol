// SPDX-License-Identifier: MIT
// contract by steviep.eth



pragma solidity ^0.8.17;


contract MMOMock {
  uint256 public contributors = 50;
  uint256 public ending = 1;
  uint256 public currentWeek = 49;

  constructor() {}

  function settlementAddressProposals(uint256 week) external view returns (address) {
    return address(1);
  }

  function votes(uint256 tokenId, uint256 week) public view returns (bool) {
    return true;
  }
}
