// SPDX-License-Identifier: MIT
// contract by steviep.eth



import "./Dependencies.sol";
import "./MMOMetadata.sol";

pragma solidity ^0.8.17;




contract MoneyMakingOpportunity is ERC721 {
  uint256 private _totalSupply = 0;
  MMOMetadata private _metadataContract;

  constructor() ERC721('Money Making Opportunity', 'MMO') {
    _metadataContract = new MMOMetadata(this);
  }

  function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
    return _metadataContract.tokenURI(tokenId);
  }

  function totalSupply() external view returns (uint256) {
    return _totalSupply;
  }

  function exists(uint256 tokenId) external view returns (bool) {
    return _exists(tokenId);
  }

  function metadataContract() external view returns (address) {
    return address(_metadataContract);
  }

  /// @notice Query if a contract implements an interface
  /// @param interfaceId The interface identifier, as specified in ERC-165
  /// @return `true` if the contract implements `interfaceId` and
  ///         `interfaceId` is not 0xffffffff, `false` otherwise
  /// @dev Interface identification is specified in ERC-165. This function
  ///      uses less than 30,000 gas. See: https://eips.ethereum.org/EIPS/eip-165
  ///      See EIP-4906: https://eips.ethereum.org/EIPS/eip-4906
  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721) returns (bool) {
    return interfaceId == bytes4(0x49064906) || super.supportsInterface(interfaceId);
  }

}
